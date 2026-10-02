import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Auth, login, tokenGrant } from '../src/auth.js';
import { CredentialStore, validateCredentials } from '../src/credentials.js';
import { config } from '../src/config.js';
import { publicError } from '../src/errors.js';

const settings = { clientId: '123456789012345678', clientSecret: 'CLIENT_SECRET', redirectUri: 'http://127.0.0.1:8765/callback' };
const token = { access_token: 'ACCESS_SECRET', refresh_token: 'REFRESH_SECRET', expires_at: 200000 };

test('キーリングは既存の専用属性で識別し、認証データを保存・取得・削除する', async () => {
  const calls = [];
  const store = new CredentialStore(settings.clientId, {
    write: async (attributes, input) => calls.push({ attributes, input }),
    read: async attributes => { calls.push({ attributes }); return JSON.stringify(token); },
    delete: async attributes => calls.push({ attributes }),
  });
  await store.save(token);
  assert.deepEqual(await store.load(), token);
  await store.clear();
  assert.equal(calls.length, 3);
  assert.ok(calls.every(call => !JSON.stringify(call.attributes).includes('SECRET')));
  assert.match(calls[0].input, /ACCESS_SECRET/);
  assert.deepEqual(calls[1].attributes, { service: 'discord-rpc-mcp', purpose: 'oauth', client_id: settings.clientId });
});

test('壊れた認証データや不正設定を値の開示なしで拒否する', async () => {
  const store = new CredentialStore(settings.clientId, { read: async () => 'SECRET' });
  await assert.rejects(store.load(), { code: 'LOGIN_REQUIRED' });
  assert.throws(() => validateCredentials({ access_token: 'SECRET', expires_at: Infinity }), { code: 'LOGIN_REQUIRED' });
  assert.throws(() => config({ DISCORD_CLIENT_ID: 'SECRET' }), { code: 'CONFIG_REQUIRED' });
  assert.throws(() => config({ DISCORD_CLIENT_ID: settings.clientId, DISCORD_ALLOW_CONTROL: 'yes' }), { code: 'INVALID_CONFIG' });
  assert.equal(config({ DISCORD_CLIENT_ID: settings.clientId }).allowControl, false);
});

test('有効な認証はOAuth通信を行わず再利用する', async () => {
  const auth = new Auth(settings, { load: async () => token }, () => assert.fail('Unexpected network access'), () => 0);
  assert.deepEqual(await auth.credentials(), token);
});

test('期限切れの同時要求は一度だけ更新し、更新トークン省略時は引き継ぐ', async () => {
  let count = 0;
  let saved;
  const auth = new Auth(settings, {
    load: async () => ({ ...token, expires_at: 1 }),
    save: async value => { saved = value; },
  }, async (url, options) => {
    count++;
    assert.equal(url, 'https://discord.com/api/oauth2/token');
    assert.equal(options.redirect, 'error');
    assert.equal(options.body.get('grant_type'), 'refresh_token');
    assert.equal(options.body.get('refresh_token'), 'REFRESH_SECRET');
    assert.equal(options.body.get('client_secret'), settings.clientSecret);
    return Response.json({ access_token: 'NEW_SECRET', expires_in: 3600 });
  }, () => 1000);
  const values = await Promise.all([auth.credentials(), auth.credentials()]);
  assert.equal(count, 1);
  assert.deepEqual(values[0], values[1]);
  assert.equal(saved.refresh_token, 'REFRESH_SECRET');
  assert.equal(saved.expires_at, 3601000);
});

test('更新拒否時に保存済み認証を上書きせず、再認可も行わない', async () => {
  const auth = new Auth(settings, {
    load: async () => ({ ...token, expires_at: 1 }),
    save: () => assert.fail('Do not overwrite'),
  }, async () => Response.json({ error: 'PRIVATE SECRET' }, { status: 400 }));
  await assert.rejects(auth.credentials(), { code: 'OAUTH_REJECTED' });
  assert.equal(auth.pending, undefined);
});

test('OAuthの通信失敗や応答本文をエラーへ含めない', async () => {
  for (const fetcher of [
    async () => { throw new Error('SECRET'); },
    async () => new Response('SECRET'),
    async () => Response.json({ access_token: 'SECRET' }),
  ]) {
    await assert.rejects(tokenGrant(settings, {}, fetcher), error => !error.message.includes('SECRET'));
  }
  assert.ok(!JSON.stringify(publicError(new Error('SECRET'))).includes('SECRET'));
});

test('loginだけが認可を要求し、認証成功後に保存する', async () => {
  const calls = [];
  let saved;
  let closed = false;
  const rpc = {
    request: async (cmd, args) => {
      calls.push({ cmd, args });
      return cmd === 'AUTHORIZE' ? { code: 'CODE_SECRET' } : { scopes: ['rpc', 'messages.read'] };
    },
    close: () => { closed = true; },
  };
  const value = await login(settings, { save: async token => { saved = token; } }, async () => rpc,
    async (_url, options) => {
      assert.equal(options.body.get('code'), 'CODE_SECRET');
      assert.equal(options.body.get('client_secret'), settings.clientSecret);
      assert.equal(options.body.has('code_verifier'), false);
      return Response.json({ access_token: 'ACCESS_SECRET', expires_in: 3600 });
    });
  assert.deepEqual(calls.map(call => call.cmd), ['AUTHORIZE', 'AUTHENTICATE']);
  assert.equal(saved.access_token, 'ACCESS_SECRET');
  assert.equal(value.authenticated, true);
  assert.ok(!JSON.stringify(value).includes('SECRET'));
  assert.equal(closed, true);
  assert.equal('code_challenge' in calls[0].args, false);
});

test('Secretなしのloginは毎回異なるS256のPKCEを使い、検証子を保存・公開しない', async () => {
  const challenges = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    let authorization, verifier, saved, closed = false;
    const publicConfig = { ...settings, clientSecret: undefined };
    const result = await login(publicConfig, { save: async value => { saved = value; } }, async () => ({
      request: async (cmd, args) => {
        if (cmd === 'AUTHORIZE') { authorization = args; return { code: 'CODE_SECRET' }; }
        assert.ok(!saved, 'Do not save before authentication');
        return { scopes: ['rpc', 'messages.read'] };
      },
      close: () => { closed = true; },
    }), async (_url, { body }) => {
      verifier = body.get('code_verifier');
      assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
      assert.equal(authorization.code_challenge_method, 'S256');
      assert.equal(authorization.code_challenge, createHash('sha256').update(verifier).digest('base64url'));
      assert.equal(body.get('client_id'), settings.clientId);
      assert.equal(body.get('code'), 'CODE_SECRET');
      assert.equal(body.get('redirect_uri'), settings.redirectUri);
      assert.equal(body.has('client_secret'), false);
      return Response.json({ access_token: token.access_token, refresh_token: token.refresh_token, expires_in: 3600 });
    });
    challenges.push(authorization.code_challenge);
    assert.equal(result.authenticated, true);
    assert.equal(saved.access_token, token.access_token);
    assert.equal(saved.client_secret, undefined);
    for (const value of [saved, result]) {
      assert.ok(!JSON.stringify(value).includes(verifier));
      assert.ok(!JSON.stringify(value).includes(authorization.code_challenge));
      assert.ok(!JSON.stringify(value).includes('CODE_SECRET'));
    }
    assert.equal(closed, true);
  }
  assert.notEqual(challenges[0], challenges[1]);
});

test('公開クライアントの更新はSecretもPKCE検証子も送らず、権限と更新トークンを保持する', async () => {
  let saved;
  const scopes = ['rpc', 'messages.read'];
  const auth = new Auth({ ...settings, clientSecret: undefined }, {
    load: async () => ({ ...token, expires_at: 1, scopes }),
    save: async value => { saved = value; },
  }, async (_url, { body }) => {
    assert.equal(body.get('client_id'), settings.clientId);
    assert.equal(body.get('grant_type'), 'refresh_token');
    assert.equal(body.get('refresh_token'), token.refresh_token);
    assert.equal(body.has('client_secret'), false);
    assert.equal(body.has('code_verifier'), false);
    return Response.json({ access_token: 'RENEWED', expires_in: 3600 });
  }, () => 1000);
  await auth.credentials();
  assert.equal(saved.refresh_token, token.refresh_token);
  assert.deepEqual(saved.scopes, scopes);
  assert.equal(saved.client_secret, undefined);
});

test('PKCEの交換が拒否されたらSecret方式に切り替えず、保存しないで接続を閉じる', async () => {
  let closed = false, grants = 0;
  await assert.rejects(login({ ...settings, clientSecret: undefined }, {
    save: () => assert.fail('Do not save rejected credentials'),
  }, async () => ({
    request: async cmd => { assert.equal(cmd, 'AUTHORIZE'); return { code: 'PRIVATE_CODE' }; },
    close: () => { closed = true; },
  }), async (_url, { body }) => {
    grants++;
    assert.ok(body.has('code_verifier'));
    return Response.json({ error: 'invalid_grant', error_description: body.get('code_verifier') }, { status: 400 });
  }), error => error.code === 'OAUTH_REJECTED' && !error.message.includes('PRIVATE_CODE'));
  assert.equal(grants, 1);
  assert.equal(closed, true);
});

test('スコープ不足のloginは保存せず接続を閉じる', async () => {
  let closed = false;
  await assert.rejects(login(settings, { save: () => assert.fail('Do not save') }, async () => ({
    request: async cmd => cmd === 'AUTHORIZE' ? { code: 'CODE' } : { scopes: ['rpc'] },
    close: () => { closed = true; },
  }), async () => Response.json({ access_token: 'SECRET', expires_in: 3600 })), { code: 'SCOPE_REQUIRED' });
  assert.equal(closed, true);
});

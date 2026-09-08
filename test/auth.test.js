import { test } from 'node:test';
import assert from 'node:assert/strict';
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
      return Response.json({ access_token: 'ACCESS_SECRET', expires_in: 3600 });
    });
  assert.deepEqual(calls.map(call => call.cmd), ['AUTHORIZE', 'AUTHENTICATE']);
  assert.equal(saved.access_token, 'ACCESS_SECRET');
  assert.equal(value.authenticated, true);
  assert.ok(!JSON.stringify(value).includes('SECRET'));
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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestedScopes } from '../src/scopes.js';
import { Auth, login } from '../src/auth.js';

const settings = { clientId: '123456789012345678', clientSecret: 'SECRET', redirectUri: 'http://127.0.0.1:8765/callback' };

test('追加スコープを重複なく指定し、未対応スコープは拒否する', () => {
  assert.deepEqual(requestedScopes('rpc.voice.read, rpc.voice.read'), ['rpc', 'messages.read', 'rpc.voice.read']);
  assert.throws(() => requestedScopes('email'), { code: 'INVALID_SCOPES' });
});

test('追加権限を要求し、実際に認証されたスコープだけを保存する', async () => {
  const scopes = requestedScopes('rpc.notifications.read');
  let saved;
  await login({ ...settings, scopes }, { save: async value => { saved = value; } }, async () => ({
    request: async (cmd, args) => {
      if (cmd === 'AUTHORIZE') { assert.deepEqual(args.scopes, scopes); return { code: 'CODE' }; }
      return { scopes };
    },
    close: () => {},
  }), async () => Response.json({ access_token: 'TOKEN', expires_in: 3600 }));
  assert.deepEqual(saved.scopes, scopes);
});

test('追加権限が付与されなかった場合は既存認証を上書きしない', async () => {
  await assert.rejects(login({ ...settings, scopes: requestedScopes('rpc.voice.write') }, {
    save: () => assert.fail('Preserve existing credentials'),
  }, async () => ({
    request: async cmd => cmd === 'AUTHORIZE' ? { code: 'CODE' } : { scopes: ['rpc', 'messages.read'] },
    close: () => {},
  }), async () => Response.json({ access_token: 'TOKEN', expires_in: 3600 })), { code: 'SCOPE_REQUIRED' });
});

test('保存済み権限が不足する場合は自動再認可や更新をせずloginを案内する', async () => {
  const auth = new Auth({ ...settings, scopes: requestedScopes('rpc.voice.write') }, {
    load: async () => ({ access_token: 'TOKEN', expires_at: 1, scopes: ['rpc', 'messages.read'] }),
  }, () => assert.fail('No automatic authorization or renewal'));
  await assert.rejects(auth.credentials(), error => error.code === 'SCOPE_REQUIRED' && error.message.includes('rpc.voice.write'));
});

test('更新応答の権限欠落を検出し、スコープ省略時は保存済み情報を維持する', async () => {
  const scopes = requestedScopes('rpc.voice.read');
  const previous = { access_token: 'TOKEN', refresh_token: 'REFRESH', expires_at: 1, scopes };
  let saved;
  const store = { load: async () => previous, save: async value => { saved = value; } };
  const auth = new Auth({ ...settings, scopes }, store,
    async () => Response.json({ access_token: 'NEW', expires_in: 3600 }));
  await auth.credentials();
  assert.deepEqual(saved.scopes, scopes);
  saved = undefined;
  const reduced = new Auth({ ...settings, scopes }, store,
    async () => Response.json({ access_token: 'NEW', expires_in: 3600, scope: 'rpc messages.read' }));
  await assert.rejects(reduced.credentials(), { code: 'SCOPE_REQUIRED' });
  assert.equal(saved, undefined);
});

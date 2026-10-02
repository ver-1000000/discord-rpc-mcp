import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { probePublicOAuth, probeScopes } from '../scripts/probe-public-oauth.js';

const clientId = '123456789012345678';

function fixture() {
  const calls = [], reports = [];
  let closed = false, connections = 0;
  const rpc = {
    async request(cmd, args) {
      calls.push({ cmd, args });
      if (cmd === 'AUTHORIZE') return { code: 'PRIVATE_CODE' };
      if (cmd === 'AUTHENTICATE') return { scopes: probeScopes };
      if (cmd === 'GET_GUILDS') return { guilds: [{ name: 'PRIVATE_GUILD' }] };
    },
    close() { closed = true; },
  };
  const grants = [];
  const options = {
    connector: async () => {
      connections++;
      let authenticated = false;
      return { ...rpc, async request(cmd, args) {
        if (cmd === 'AUTHENTICATE') {
          assert.equal(authenticated, false, 'Use a new RPC connection for refreshed credentials');
          authenticated = true;
        }
        return rpc.request(cmd, args);
      } };
    }, report: value => reports.push(value),
    fetcher: async (_url, request) => {
      grants.push(request.body);
      return Response.json({ access_token: 'PRIVATE_ACCESS', refresh_token: 'PRIVATE_REFRESH' });
    },
  };
  return { options, calls, reports, grants, closed: () => closed, connections: () => connections };
}

test('公開クライアント検証はPKCEを結び付け、Secretなしで取得・更新し、結果に秘密を含めない', async () => {
  const fixtureData = fixture();
  const result = await probePublicOAuth(clientId, fixtureData.options);
  assert.equal(result.success, true);
  assert.equal(result.guildCount, 1);
  assert.equal(result.credentialsStored, false);
  const authorization = fixtureData.calls[0].args;
  assert.equal(authorization.code_challenge_method, 'S256');
  const verifier = fixtureData.grants[0].get('code_verifier');
  assert.equal(createHash('sha256').update(verifier).digest('base64url'), authorization.code_challenge);
  assert.equal(fixtureData.grants[1].get('grant_type'), 'refresh_token');
  assert.ok(fixtureData.grants.every(body => !body.has('client_secret')));
  assert.ok(!JSON.stringify(fixtureData.reports).includes('PRIVATE'));
  assert.equal(fixtureData.closed(), true);
  assert.equal(fixtureData.connections(), 2);
});

test('OAuthの拒否では工程と既知のエラー名だけ公開し、Discord接続を閉じる', async () => {
  const f = fixture();
  f.options.fetcher = async () => Response.json({ error: 'invalid_client', error_description: 'PRIVATE_CODE' }, { status: 401 });
  const result = await probePublicOAuth(clientId, f.options);
  assert.equal(result.stage, 'token_exchange');
  assert.equal(result.code, 'OAUTH_REJECTED');
  assert.ok(!JSON.stringify(f.reports).includes('PRIVATE'));
  assert.equal(f.closed(), true);
});

test('間違ったPKCE verifierが通る経路は成功扱いにせず、取得したトークンを使わない', async () => {
  const f = fixture();
  const result = await probePublicOAuth(clientId, { ...f.options, wrongVerifier: true });
  assert.equal(result.code, 'PKCE_NOT_ENFORCED');
  assert.equal(f.calls.length, 1);
  assert.equal(f.closed(), true);
});

test('以前の認可要求との比較ではPKCEを付けず、認可コードを交換・公開しない', async () => {
  const f = fixture();
  const result = await probePublicOAuth(clientId, { ...f.options, authorizeOnly: true });
  assert.equal(result.authorizationCodeReceived, true);
  assert.equal(f.calls[0].args.code_challenge, undefined);
  assert.equal(f.grants.length, 0);
  assert.ok(!JSON.stringify(f.reports).includes('PRIVATE'));
  assert.equal(f.closed(), true);
});

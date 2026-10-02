import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { EventEmitter } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Runtime } from '../src/runtime.js';
import { Setup } from '../src/setup/index.js';
import { CredentialStore } from '../src/credentials.js';
import { createServer } from '../src/server.js';
import { BridgeError, publicError } from '../src/errors.js';
import { Script } from 'node:vm';

const input = { clientId: '123456789012345678', clientSecret: 'DUMMY_CLIENT_SECRET',
  redirectUri: 'http://127.0.0.1:8765/callback', allowControl: false, scopes: [], storage: 'keyring' };
const token = { access_token: 'DUMMY_ACCESS_TOKEN', refresh_token: 'DUMMY_REFRESH_TOKEN',
  expires_at: Date.now() + 3600000, scopes: ['rpc', 'messages.read'] };

async function fixture(t, { previous, storageError } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'discord-setup-'));
  const records = new Map();
  if (previous) records.set(input.clientId, JSON.stringify(previous));
  const calls = [];
  const backend = {
    async read(attributes) {
      if (storageError) throw new BridgeError(storageError, 'Unlock your keyring.');
      if (!records.has(attributes.client_id)) throw new BridgeError('LOGIN_REQUIRED', 'Run setup.');
      return records.get(attributes.client_id);
    },
    async write(attributes, value) { records.set(attributes.client_id, value); },
    async delete(attributes) { records.delete(attributes.client_id); },
  };
  const dependencies = {
    env: {}, directory,
    storeFactory: id => new CredentialStore(id, backend),
    connector: async () => ({
      socket: new EventEmitter(),
      request: async (cmd, args) => {
        calls.push({ cmd, args });
        if (cmd === 'AUTHORIZE') return { code: 'DUMMY_CODE' };
        if (cmd === 'AUTHENTICATE') return { scopes: ['rpc', 'messages.read', 'rpc.voice.write'] };
        return { guilds: [] };
      },
      close() { this.socket.destroyed = true; this.socket.emit('close'); },
    }),
    fetcher: async () => Response.json({ access_token: token.access_token, refresh_token: token.refresh_token, expires_in: 3600 }),
  };
  const runtime = new Runtime(dependencies);
  await runtime.initialize();
  const setup = new Setup(runtime, { browser: async () => false });
  t.after(async () => { setup.close(); runtime.bridge.close(); await rm(directory, { recursive: true, force: true }); });
  return { runtime, setup, directory, records, calls, dependencies };
}
function post(url, value = input, headers = {}) {
  return fetch(url, { method: 'POST', headers: { Origin: new URL(url).origin,
    'Content-Type': 'application/json', 'X-Setup-Token': url.split('/').at(-1), ...headers }, body: JSON.stringify(value) });
}

test('未設定のMCPからsetupを開始し、Client IDだけで接続・権限変更できる', async t => {
  const { runtime, setup, directory } = await fixture(t);
  const server = createServer(runtime.bridge, runtime.settings, setup);
  const client = new Client({ name: 'setup-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
  t.after(async () => { await client.close(); await server.close(); });
  assert.equal((await client.listTools()).tools.length, 11);
  const unavailable = await client.callTool({ name: 'get_guilds', arguments: {} });
  assert.equal(JSON.parse(unavailable.content[0].text).code, 'SETUP_REQUIRED');
  const rejected = await client.callTool({ name: 'setup', arguments: { clientSecret: 'PRIVATE' } });
  assert.equal(rejected.isError, true);
  const started = await client.callTool({ name: 'setup', arguments: {} });
  const url = started.structuredContent.setupUrl;
  assert.equal((await setup.start()).setupUrl, url);
  const page = await fetch(url);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const html = await page.text();
  assert.ok(!html.includes('clientSecret'));
  assert.match(html, /<strong>公開クライアント<\/strong>/);
  assert.match(html, /<strong>Public Client<\/strong>/);
  new Script(html.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1]);
  const response = await post(url, { ...input, clientSecret: undefined, storage: undefined, allowControl: true, scopes: ['rpc.voice.write'] });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: true });
  const status = await client.callTool({ name: 'setup_status', arguments: {} });
  assert.equal(status.structuredContent.setupState, 'complete');
  assert.equal(status.structuredContent.canRefresh, true);
  assert.ok(!JSON.stringify(status).includes('DUMMY'));
  const settings = await readFile(join(directory, 'settings.json'), 'utf8');
  assert.ok(!settings.includes('SECRET') && !settings.includes('TOKEN'));
  assert.ok((await client.listTools()).tools.some(tool => tool.name === 'set_voice_settings'));
  const guilds = await client.callTool({ name: 'get_guilds', arguments: {} });
  assert.equal(guilds.isError, undefined);
});

test('異なるOrigin・Host・CSRF・パス・巨大な入力を保存前に拒否する', async t => {
  const { setup, records } = await fixture(t);
  const { setupUrl } = await setup.start();
  for (const headers of [{ Origin: 'https://evil.example' }, { Host: 'evil.example' },
    { 'X-Setup-Token': 'invalid' }, { 'Content-Type': 'text/plain' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    const status = await new Promise((resolve, reject) => {
      const req = request(setupUrl, { method: 'POST', headers: { Origin: new URL(setupUrl).origin, 'Content-Type': 'application/json', 'X-Setup-Token': setupUrl.split('/').at(-1), ...headers } }, response => { response.resume(); resolve(response.statusCode); });
      req.on('error', reject); req.end(JSON.stringify(input));
    });
    assert.equal(status, 403, JSON.stringify(headers));
  }
  assert.equal((await fetch(setupUrl + 'wrong')).status, 403);
  const oversized = await post(setupUrl, { ...input, clientSecret: 'x'.repeat(9000) }).catch(() => null);
  if (oversized) assert.equal(oversized.status, 413);
  assert.equal(records.size, 0);
});

test('初回と再設定で表示する追加権限をすべて選択し、承認前に保存済み設定を変更しない', async t => {
  const { runtime, setup, records } = await fixture(t);
  const url = (await setup.start()).setupUrl;
  const defaults = async () => {
    const html = await (await fetch(url)).text();
    const data = JSON.parse(html.match(/const \{ token, defaults, scopes \} = (.*);/)[1]);
    assert.ok(!data.scopes.includes('voice'));
    return data.defaults;
  };
  const initial = await defaults();
  assert.equal(initial.allowControl, true);
  assert.deepEqual(initial.scopes, ['rpc', 'messages.read', 'rpc.activities.write',
    'rpc.notifications.read', 'rpc.voice.read', 'rpc.voice.write',
    'rpc.video.read', 'rpc.video.write', 'rpc.screenshare.read', 'rpc.screenshare.write']);
  assert.equal(records.size, 0);
  await runtime.setup(input);
  const saved = records.get(input.clientId);
  const reopened = await defaults();
  assert.equal(reopened.allowControl, false);
  assert.deepEqual(reopened.scopes, initial.scopes);
  assert.deepEqual(runtime.settings.scopes, ['rpc', 'messages.read']);
  assert.equal(records.get(input.clientId), saved);
});

test('既存のvoice選択がある場合は保持し、他の追加権限も選択する', async t => {
  const { runtime, setup } = await fixture(t);
  runtime.settings.clientId = input.clientId;
  runtime.settings.scopes = ['rpc', 'messages.read', 'voice'];
  const html = await (await fetch((await setup.start()).setupUrl)).text();
  const data = JSON.parse(html.match(/const \{ token, defaults, scopes \} = (.*);/)[1]);
  assert.ok(data.scopes.includes('voice'));
  assert.deepEqual(data.defaults.scopes, ['rpc', 'messages.read', ...data.scopes]);
  assert.deepEqual(runtime.settings.scopes, ['rpc', 'messages.read', 'voice']);
});

test('ロックされたキーリングからファイル保存へ自動で切り替えない', async t => {
  const { runtime, setup, directory } = await fixture(t, { storageError: 'KEYRING_LOCKED' });
  const { setupUrl } = await setup.start();
  const response = await post(setupUrl);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'KEYRING_LOCKED');
  assert.equal(runtime.settings.clientId, undefined);
  await assert.rejects(readFile(join(directory, 'settings.json')), { code: 'ENOENT' });
});

test('0.1.0の有効な認証は再認可なしで移行し、Secretも保存する', async t => {
  const { runtime, records, calls } = await fixture(t, { previous: token });
  await runtime.setup(input);
  assert.deepEqual(calls.map(call => call.cmd), ['AUTHENTICATE']);
  assert.equal(JSON.parse(records.get(input.clientId)).client_secret, input.clientSecret);
  assert.equal((await runtime.status()).canRefresh, true);
  await runtime.login();
  assert.equal(JSON.parse(records.get(input.clientId)).client_secret, input.clientSecret);
});

test('利用者の別アプリで接続し、以前のアプリの認証を削除しない', async t => {
  const { runtime, records, calls, directory, dependencies } = await fixture(t, { previous: token });
  await runtime.setup(input);
  const previous = records.get(input.clientId);
  calls.length = 0;
  const ownApp = { ...input, clientId: '987654321098765432', clientSecret: 'OTHER_DUMMY_SECRET' };
  await runtime.setup(ownApp);
  const authorization = calls.find(call => call.cmd === 'AUTHORIZE');
  assert.equal(authorization.args.client_id, ownApp.clientId);
  assert.equal(records.get(input.clientId), previous);
  assert.equal(JSON.parse(records.get(ownApp.clientId)).client_secret, ownApp.clientSecret);
  assert.equal(JSON.parse(await readFile(join(directory, 'settings.json'), 'utf8')).clientId, ownApp.clientId);
  const restarted = new Runtime(dependencies);
  await restarted.initialize();
  assert.equal(restarted.settings.clientId, ownApp.clientId);
  assert.equal((await restarted.status()).credentialsStored, true);
});

test('キーリングで再起動後もSecretを読み込み、更新時に保持する', async t => {
  const { runtime, directory, dependencies } = await fixture(t);
  await runtime.setup(input);
  const stored = await runtime.store().load();
  await runtime.store().save({ ...stored, expires_at: 1 });
  const restarted = new Runtime({ ...dependencies, fetcher: async (_url, options) => {
    assert.equal(options.body.get('client_secret'), input.clientSecret);
    return Response.json({ access_token: 'RENEWED', expires_in: 3600 });
  } });
  await restarted.initialize();
  const renewed = await restarted.auth().credentials();
  assert.equal(renewed.client_secret, input.clientSecret);
  assert.equal(renewed.refresh_token, token.refresh_token);
  assert.ok(!JSON.stringify(await restarted.status()).includes('SECRET'));
  await restarted.store().clear();
  assert.equal((await restarted.status()).credentialsStored, false);
});

test('Client IDのみの設定を再起動後に更新・再認可でき、以前のSecret設定も保持する', async t => {
  const { runtime, records, calls, dependencies } = await fixture(t);
  await runtime.setup(input);
  const legacy = records.get(input.clientId);
  const ownApp = { ...input, clientId: '987654321098765432', clientSecret: undefined };
  await runtime.setup(ownApp);
  assert.equal(records.get(input.clientId), legacy);
  assert.equal(JSON.parse(records.get(ownApp.clientId)).client_secret, undefined);
  assert.equal(calls.findLast(call => call.cmd === 'AUTHORIZE').args.code_challenge_method, 'S256');
  await runtime.store().save({ ...await runtime.store().load(), expires_at: 1 });
  const grants = [];
  const restarted = new Runtime({ ...dependencies, fetcher: async (_url, { body }) => {
    grants.push(body.get('grant_type'));
    assert.equal(body.has('client_secret'), false);
    assert.equal(body.has('code_verifier'), body.get('grant_type') === 'authorization_code');
    return Response.json({ access_token: 'RENEWED', refresh_token: token.refresh_token, expires_in: 3600 });
  } });
  await restarted.initialize();
  assert.equal((await restarted.status()).canRefresh, true);
  await restarted.auth().credentials();
  await restarted.login();
  assert.deepEqual(grants, ['refresh_token', 'authorization_code']);
  assert.equal(JSON.parse(records.get(ownApp.clientId)).client_secret, undefined);
  assert.equal(records.get(input.clientId), legacy);
});

test('新しい画面から既存のSecret設定を開き直しても、保存済みSecretを削除しない', async t => {
  const { runtime, records, calls } = await fixture(t, { previous: { ...token, client_secret: input.clientSecret } });
  await runtime.setup({ ...input, clientSecret: undefined });
  assert.deepEqual(calls.map(call => call.cmd), ['AUTHENTICATE']);
  assert.equal(JSON.parse(records.get(input.clientId)).client_secret, input.clientSecret);
  await runtime.login();
  assert.equal(JSON.parse(records.get(input.clientId)).client_secret, input.clientSecret);
  assert.equal('code_challenge' in calls.find(call => call.cmd === 'AUTHORIZE').args, false);
  await runtime.store().save({ ...await runtime.store().load(), scopes: ['rpc'] });
  calls.length = 0;
  await runtime.setup({ ...input, clientSecret: undefined });
  assert.equal('code_challenge' in calls.find(call => call.cmd === 'AUTHORIZE').args, false);
  assert.equal(JSON.parse(records.get(input.clientId)).client_secret, input.clientSecret);
});

test('認可失敗は既存認証を維持し、HTTP応答に秘密を含めない', async t => {
  const { runtime, setup, records } = await fixture(t, { previous: { ...token, scopes: ['rpc'] } });
  runtime.fetcher = async () => Response.json({ error: 'DUMMY_CLIENT_SECRET' }, { status: 400 });
  const previous = records.get(input.clientId);
  const response = await post((await setup.start()).setupUrl);
  assert.equal(response.status, 400);
  const error = await response.json();
  assert.equal(error.stage, 'token_exchange');
  assert.deepEqual(error.requestedScopes, ['rpc', 'messages.read']);
  assert.ok(!JSON.stringify(error).includes('DUMMY'));
  assert.equal(records.get(input.clientId), previous);
});

test('セッション終了後に古いURLを再利用できず、再セットアップで別URLを発行する', async t => {
  const { setup } = await fixture(t);
  const first = (await setup.start()).setupUrl;
  setup.expire();
  await assert.rejects(fetch(first));
  const second = (await setup.start()).setupUrl;
  assert.notEqual(first, second);
  const oldPath = new URL(first).pathname;
  const stale = new URL(second); stale.pathname = oldPath;
  assert.equal((await fetch(stale)).status, 403);
});


test('保存済みトークンがDiscordに拒否された場合はブラウザ操作から再認可する', async t => {
  const { runtime, records, calls } = await fixture(t, { previous: token });
  const connector = runtime.connector;
  let rejected = false;
  runtime.connector = async (...args) => {
    const rpc = await connector(...args);
    const request = rpc.request;
    rpc.request = async (cmd, input) => {
      if (cmd === 'AUTHENTICATE' && !rejected) { rejected = true; throw new BridgeError('RPC_ERROR', 'RPC error 4006'); }
      return request(cmd, input);
    };
    return rpc;
  };
  await runtime.setup(input);
  assert.ok(calls.some(call => call.cmd === 'AUTHORIZE'));
  assert.equal(JSON.parse(records.get(input.clientId)).client_secret, input.clientSecret);
});

for (const [command, stage] of [['AUTHORIZE', 'authorize'], ['AUTHENTICATE', 'authenticate']]) {
  test(`同じRPCエラーでも${command}での失敗をブラウザとAgentが判別できる`, async t => {
    const { runtime, setup, records } = await fixture(t);
    const connect = runtime.connector;
    runtime.connector = async (...args) => {
      const rpc = await connect(...args);
      const request = rpc.request;
      rpc.request = async (cmd, args) => {
        if (cmd === command) throw new BridgeError('RPC_ERROR', 'RPC error 5000 (invalid_scope)');
        return request(cmd, args);
      };
      return rpc;
    };
    const response = await post((await setup.start()).setupUrl);
    assert.equal(response.status, 400);
    const failure = await response.json();
    assert.deepEqual(failure, { code: 'RPC_ERROR', message: 'RPC error 5000 (invalid_scope)',
      stage, requestedScopes: ['rpc', 'messages.read'] });
    assert.deepEqual((await setup.status()).error, failure);
    assert.equal(records.size, 0);
  });
}

test('診断情報から未知の工程や秘密らしい文字列を公開しない', () => {
  const error = new BridgeError('RPC_ERROR', 'RPC error');
  error.setupStage = 'authorize';
  error.requestedScopes = ['DUMMY_CLIENT_SECRET'];
  assert.deepEqual(publicError(error), { code: 'RPC_ERROR', message: 'RPC error', stage: 'authorize' });
  error.setupStage = 'DUMMY_CLIENT_SECRET';
  assert.deepEqual(publicError(error), { code: 'RPC_ERROR', message: 'RPC error' });
});

test('映像と画面共有を含む全権限の認可失敗を秘密なしで診断できる', async t => {
  const { runtime, setup, records } = await fixture(t);
  runtime.connector = async () => ({
    request: async () => { throw new BridgeError('RPC_ERROR', 'RPC error 5000 (invalid_scope)'); },
    close() {},
  });
  const scopes = ['rpc.activities.write', 'rpc.notifications.read', 'rpc.voice.read', 'rpc.voice.write',
    'rpc.video.read', 'rpc.video.write', 'rpc.screenshare.read', 'rpc.screenshare.write'];
  const response = await post((await setup.start()).setupUrl, { ...input, scopes });
  const error = await response.json();
  assert.equal(response.status, 400);
  assert.equal(error.stage, 'authorize');
  assert.deepEqual(error.requestedScopes, ['rpc', 'messages.read', ...scopes]);
  assert.equal(records.size, 0);
  assert.ok(!JSON.stringify(error).includes('DUMMY'));
});


test('平文保存の要求を認可前に拒否し、既存のキーリング認証を維持する', async t => {
  const { setup, records, calls, directory } = await fixture(t, { previous: token });
  const previous = records.get(input.clientId);
  const response = await post((await setup.start()).setupUrl, { ...input, storage: 'file' });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'INVALID_CONFIG');
  assert.equal(calls.length, 0);
  assert.equal(records.get(input.clientId), previous);
  await assert.rejects(readFile(join(directory, `credentials-${input.clientId}.json`)), { code: 'ENOENT' });
});

test('古いenv設定とファイル保存設定を秘密の表示なしで拒否する', async t => {
  const { dependencies, directory } = await fixture(t);
  const runtime = new Runtime({ ...dependencies, env: { DISCORD_CLIENT_SECRET: 'DUMMY_SECRET' } });
  await assert.rejects(runtime.initialize(), error => error.code === 'INVALID_CONFIG' && !error.message.includes('DUMMY_SECRET'));
  await writeFile(join(directory, 'settings.json'), JSON.stringify({ ...input, clientSecret: undefined, storage: 'file' }), { mode: 0o600 });
  await assert.rejects(new Runtime(dependencies).initialize(), { code: 'INVALID_CONFIG' });
});

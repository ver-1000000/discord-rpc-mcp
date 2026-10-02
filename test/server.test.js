import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';
import { commands } from '../src/commands.js';
import { EventBuffer } from '../src/events.js';
import { BridgeError } from '../src/errors.js';

async function fixture(t, allowControl = false, scopes = ['rpc', 'messages.read', 'rpc.video.write', 'rpc.screenshare.write']) {
  const calls = [];
  const bridge = {
    events: new EventBuffer(),
    request: async (cmd, args) => { calls.push({ cmd, args }); return { messages: [] }; },
    subscription: async (cmd, args) => { calls.push({ cmd, args }); return { subscribed: true }; },
    readEvents: () => ({ events: [], historyComplete: false }),
    close: () => {},
  };
  const server = createServer(bridge, { allowControl, scopes });
  const client = new Client({ name: 'test', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  t.after(async () => { await client.close(); await server.close(); });
  return { client, calls, bridge };
}

test('標準構成では変更ツールと認証ツールを公開しない', async t => {
  const { client, calls } = await fixture(t);
  const { tools } = await client.listTools();
  assert.equal(tools.length, 9);
  assert.ok(tools.every(tool => !/^(set_|select_|send_|close_|toggle_|authorize|authenticate)/.test(tool.name)));
  assert.equal(tools.find(tool => tool.name === 'get_channel').annotations.readOnlyHint, true);
  assert.equal(calls.length, 0);
});

test('変更を有効化すると対応する全操作と購読を公開する', async t => {
  const { client } = await fixture(t, true);
  const { tools } = await client.listTools();
  assert.equal(tools.length, commands.length + 3);
  assert.equal(tools.find(tool => tool.name === 'set_activity').annotations.destructiveHint, true);
});

test('映像と画面共有のトグルを反転操作として公開し、指定した引数で一度だけ実行する', async t => {
  const { client, calls } = await fixture(t, true);
  const { tools } = await client.listTools();
  for (const name of ['toggle_video', 'toggle_screenshare']) {
    const tool = tools.find(tool => tool.name === name);
    assert.equal(tool.annotations.readOnlyHint, false);
    assert.equal(tool.annotations.destructiveHint, true);
    assert.equal(tool.annotations.idempotentHint, false);
  }
  for (const [name, args] of [['toggle_video', {}], ['toggle_screenshare', {}], ['toggle_screenshare', { pid: 1234 }]]) {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, undefined);
  }
  assert.deepEqual(calls, [
    { cmd: 'TOGGLE_VIDEO', args: {} },
    { cmd: 'TOGGLE_SCREENSHARE', args: {} },
    { cmd: 'TOGGLE_SCREENSHARE', args: { pid: 1234 } },
  ]);
});

test('映像と画面共有の権限不足や不正な引数はトグルを送らずに拒否する', async t => {
  const missing = await fixture(t, true, ['rpc', 'messages.read']);
  for (const [name, scope] of [['toggle_video', 'rpc.video.write'], ['toggle_screenshare', 'rpc.screenshare.write']]) {
    const result = await missing.client.callTool({ name, arguments: {} });
    assert.equal(result.isError, true);
    const error = JSON.parse(result.content[0].text);
    assert.equal(error.code, 'SCOPE_REQUIRED');
    assert.ok(error.message.includes(scope));
  }
  assert.deepEqual(missing.calls, []);
  const enabled = await fixture(t, true);
  for (const request of [
    { name: 'toggle_video', arguments: { enabled: true } },
    { name: 'toggle_screenshare', arguments: { pid: 0 } },
    { name: 'toggle_screenshare', arguments: { pid: -1 } },
    { name: 'toggle_screenshare', arguments: { pid: 1.5 } },
    { name: 'toggle_screenshare', arguments: { pid: '1234' } },
    { name: 'toggle_screenshare', arguments: { enabled: false } },
  ]) {
    assert.equal((await enabled.client.callTool(request)).isError, true);
  }
  assert.deepEqual(enabled.calls, []);
});

test('トグルがタイムアウトしても自動再実行しない', async t => {
  const { client, bridge } = await fixture(t, true);
  let attempts = 0;
  bridge.request = async () => { attempts++; throw new BridgeError('TIMEOUT', 'RPC request timed out.'); };
  const result = await client.callTool({ name: 'toggle_video', arguments: {} });
  assert.equal(result.isError, true);
  assert.equal(JSON.parse(result.content[0].text).code, 'TIMEOUT');
  assert.equal(attempts, 1);
});

test('GET_CHANNELを対応するRPCへ渡し、空配列と未取得を区別する', async t => {
  const { client, calls, bridge } = await fixture(t);
  const args = { channel_id: '123456789012345678' };
  const first = await client.callTool({ name: 'get_channel', arguments: args });
  assert.deepEqual(calls, [{ cmd: 'GET_CHANNEL', args }]);
  assert.equal(first.structuredContent.metadata.messageCount, 0);
  assert.equal(first.structuredContent.metadata.historyComplete, false);
  assert.equal(first.structuredContent.metadata.mayChangeView, false);
  bridge.request = async () => ({ id: args.channel_id });
  const next = await client.callTool({ name: 'get_channel', arguments: args });
  assert.equal(next.structuredContent.metadata.messageCount, null);
});

test('不正な引数と購読の対象不足をRPC実行前に拒否する', async t => {
  const { client, calls } = await fixture(t);
  for (const request of [
    { name: 'get_channel', arguments: { channel_id: 'bad' } },
    { name: 'get_guilds', arguments: { access_token: 'SECRET' } },
    { name: 'subscribe', arguments: { event: 'MESSAGE_CREATE' } },
  ]) {
    const result = await client.callTool(request);
    assert.equal(result.isError, true);
  }
  assert.deepEqual(calls, []);
});

test('例外・過大結果を安全なツールエラーとして返す', async t => {
  const { client, bridge } = await fixture(t);
  bridge.request = async () => { throw new Error('SECRET'); };
  const first = await client.callTool({ name: 'get_guilds', arguments: {} });
  assert.equal(first.isError, true);
  assert.ok(!JSON.stringify(first).includes('SECRET'));
  bridge.request = async () => ({ value: 'x'.repeat(2 * 1024 * 1024) });
  const next = await client.callTool({ name: 'get_guilds', arguments: {} });
  assert.equal(JSON.parse(next.content[0].text).code, 'RESULT_TOO_LARGE');
});

test('SET_ACTIVITYの文書化されたフィールドを省略せずRPCへ渡す', async t => {
  const { client, calls } = await fixture(t, true);
  const args = {
    pid: 1234,
    activity: {
      name: 'Example', type: 0, url: null, created_at: 1700000000000,
      application_id: '123456789012345678', status_display_type: 2,
      state: null, details: 'Building a bridge', state_url: null, details_url: 'https://example.com',
      emoji: { name: 'cat', id: '123456789012345679', animated: false },
      timestamps: { start: 1700000000000, end: 1700000060000 },
      assets: {
        large_image: 'large', large_text: 'Large', large_url: 'https://example.com/large',
        small_image: 'small', small_text: 'Small', small_url: 'https://example.com/small',
        invite_cover_image: 'cover',
      },
      party: { id: 'party', size: [1, 2] },
      secrets: { join: 'join-example', spectate: 'spectate-example', match: 'match-example' },
      buttons: [{ label: 'Open', url: 'https://example.com' }],
      instance: true, flags: 3,
    },
  };
  const result = await client.callTool({ name: 'set_activity', arguments: args });
  assert.equal(result.isError, undefined);
  assert.deepEqual(calls, [{ cmd: 'SET_ACTIVITY', args }]);
});

test('SET_ACTIVITYの表示種類・nullableフィールド・全体解除を扱う', async t => {
  const { client, calls } = await fixture(t, true);
  for (const status_display_type of [0, 1, 2, null]) {
    const result = await client.callTool({
      name: 'set_activity',
      arguments: { pid: 1234, activity: { status_display_type, details: null, emoji: null, details_url: null } },
    });
    assert.equal(result.isError, undefined);
    assert.equal(calls.at(-1).args.activity.status_display_type, status_display_type);
  }
  const result = await client.callTool({ name: 'set_activity', arguments: { pid: 1234, activity: null } });
  assert.equal(result.isError, undefined);
  assert.equal(calls.at(-1).args.activity, null);
});

test('SET_ACTIVITYの不正な表示種類・RPC非対応type・過大ボタンを拒否する', async t => {
  const { client, calls } = await fixture(t, true);
  for (const activity of [
    { status_display_type: 3 }, { status_display_type: '2' },
    { type: 1 }, { type: 4 }, { flags: -1 },
    { buttons: [{ label: 'Open', url: 'https://example.com/' + 'x'.repeat(512) }] },
    { typo: true },
  ]) {
    const result = await client.callTool({ name: 'set_activity', arguments: { pid: 1234, activity } });
    assert.equal(result.isError, true);
  }
  assert.deepEqual(calls, []);
});

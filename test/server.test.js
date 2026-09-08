import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';
import { commands } from '../src/commands.js';

async function fixture(t, allowControl = false) {
  const calls = [];
  const bridge = {
    request: async (cmd, args) => { calls.push({ cmd, args }); return { messages: [] }; },
    subscription: async (cmd, args) => { calls.push({ cmd, args }); return { subscribed: true }; },
    readEvents: () => ({ events: [], historyComplete: false }),
    close: () => {},
  };
  const server = createServer(bridge, { allowControl });
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
  assert.ok(tools.every(tool => !/^(set_|select_|send_|close_|authorize|authenticate)/.test(tool.name)));
  assert.equal(tools.find(tool => tool.name === 'get_channel').annotations.readOnlyHint, false);
  assert.equal(calls.length, 0);
});

test('変更を有効化すると文書化された全操作と購読を公開する', async t => {
  const { client } = await fixture(t, true);
  const { tools } = await client.listTools();
  assert.equal(tools.length, commands.length + 3);
  assert.equal(tools.find(tool => tool.name === 'set_activity').annotations.destructiveHint, true);
});

test('GET_CHANNELを対応するRPCへ渡し、空配列と未取得を区別する', async t => {
  const { client, calls, bridge } = await fixture(t);
  const args = { channel_id: '123456789012345678' };
  const first = await client.callTool({ name: 'get_channel', arguments: args });
  assert.deepEqual(calls, [{ cmd: 'GET_CHANNEL', args }]);
  assert.equal(first.structuredContent.metadata.messageCount, 0);
  assert.equal(first.structuredContent.metadata.historyComplete, false);
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

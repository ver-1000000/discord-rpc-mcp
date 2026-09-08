import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ResourceUpdatedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { createServer } from '../src/server.js';
import { Bridge } from '../src/bridge.js';
import { eventNames } from '../src/commands.js';
import { eventsUri } from '../src/event-resource.js';

async function fixture(t) {
  const bridge = new Bridge({}, { credentials: () => assert.fail('Must not authenticate') });
  const server = createServer(bridge);
  const client = new Client({ name: 'resource-test', version: '1' });
  const notifications = [];
  client.setNotificationHandler(ResourceUpdatedNotificationSchema, value => notifications.push(value));
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  t.after(async () => { await client.close(); await server.close(); });
  return { bridge, server, client, notifications };
}

test('リソース一覧・読み取り・購読はDiscordへ接続せず、ツール数も変わらない', async t => {
  const { client } = await fixture(t);
  assert.equal(client.getServerCapabilities().resources.subscribe, true);
  assert.equal((await client.listTools()).tools.length, 9);
  assert.equal((await client.listResources()).resources[0].uri, eventsUri);
  const result = JSON.parse((await client.readResource({ uri: eventsUri })).contents[0].text);
  assert.deepEqual(result.events, []);
  assert.equal(result.connected, false);
  await client.subscribeResource({ uri: eventsUri });
});

test('全種類のイベントを保存後にURIだけ通知し、リソースとツールで同じデータを読める', async t => {
  const { bridge, client, notifications } = await fixture(t);
  await client.subscribeResource({ uri: eventsUri });
  for (const event of eventNames) bridge.events.push({ event, data: { text: 'PRIVATE_MESSAGE' } });
  await nextTurn();
  assert.equal(notifications.length, eventNames.length);
  assert.ok(notifications.every(n => n.params.uri === eventsUri && !JSON.stringify(n).includes('PRIVATE_MESSAGE')));
  const resource = JSON.parse((await client.readResource({ uri: eventsUri })).contents[0].text);
  const tool = await client.callTool({ name: 'get_events', arguments: { limit: 100 } });
  assert.deepEqual(resource, tool.structuredContent);
  assert.deepEqual(resource.events.map(e => e.event), eventNames);
});

test('購読前・解除後は通知せず、重複購読でも通知は増えない', async t => {
  const { bridge, client, notifications } = await fixture(t);
  bridge.events.push({ event: 'MESSAGE_CREATE' });
  await nextTurn();
  assert.equal(notifications.length, 0);
  await client.subscribeResource({ uri: eventsUri });
  await client.subscribeResource({ uri: eventsUri });
  bridge.events.push({ event: 'MESSAGE_CREATE' });
  await nextTurn();
  assert.equal(notifications.length, 1);
  await client.unsubscribeResource({ uri: eventsUri });
  await client.unsubscribeResource({ uri: eventsUri });
  bridge.events.push({ event: 'MESSAGE_CREATE' });
  await nextTurn();
  assert.equal(notifications.length, 1);
});

test('不明なURIを拒否し、既存購読は維持する', async t => {
  const { client, bridge, notifications } = await fixture(t);
  await client.subscribeResource({ uri: eventsUri });
  await assert.rejects(client.subscribeResource({ uri: 'discord://unknown' }), { code: -32602 });
  await assert.rejects(client.unsubscribeResource({ uri: 'discord://unknown' }), { code: -32602 });
  bridge.events.push({ event: 'MESSAGE_CREATE' });
  await nextTurn();
  assert.equal(notifications.length, 1);
});

test('切断と過大イベントの欠落も通知してメタデータから検出できる', async t => {
  const { bridge, client, notifications } = await fixture(t);
  await client.subscribeResource({ uri: eventsUri });
  bridge.rpc = { socket: { destroyed: true }, close() {} };
  bridge.onDisconnect(bridge.rpc);
  bridge.events.push({ event: 'MESSAGE_CREATE', data: 'x'.repeat(1024 * 1024) });
  await nextTurn();
  assert.equal(notifications.length, 2);
  const value = JSON.parse((await client.readResource({ uri: eventsUri })).contents[0].text);
  assert.equal(value.connectionGapOccurred, true);
  assert.equal(value.events[0].event, 'CONNECTION_CLOSED');
  assert.equal(value.gap, true);
  assert.equal(value.droppedTotal, 1);
});

test('ホストごとの購読を分離し、接続終了時にリスナーを除去する', async t => {
  const one = await fixture(t);
  const two = await fixture(t);
  await one.client.subscribeResource({ uri: eventsUri });
  one.bridge.events.push({ event: 'MESSAGE_CREATE' });
  two.bridge.events.push({ event: 'MESSAGE_CREATE' });
  await nextTurn();
  assert.equal(one.notifications.length, 1);
  assert.equal(two.notifications.length, 0);
  await one.client.close();
  await nextTurn();
  assert.equal(one.bridge.events.listenerCount('updated'), 0);
});

test('通知失敗でもイベントの保存と次回通知を続ける', async t => {
  const { server, bridge, client, notifications } = await fixture(t);
  await client.subscribeResource({ uri: eventsUri });
  const original = server.server.sendResourceUpdated.bind(server.server);
  server.server.sendResourceUpdated = async () => { throw new Error('Transport failure'); };
  bridge.events.push({ event: 'MESSAGE_CREATE' });
  await nextTurn();
  assert.equal(bridge.events.read().events.length, 1);
  server.server.sendResourceUpdated = original;
  bridge.events.push({ event: 'MESSAGE_UPDATE' });
  await nextTurn();
  assert.equal(notifications.length, 1);
  assert.equal(bridge.events.read().events.length, 2);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Bridge } from '../src/bridge.js';

function fixture() {
  const connections = [];
  const calls = [];
  const bridge = new Bridge({ clientId: '123456789012345678' }, {
    credentials: async () => ({ access_token: 'SECRET', expires_at: Date.now() + 3600000 }),
  }, async () => {
    const socket = new EventEmitter();
    socket.destroyed = false;
    const rpc = {
      socket,
      request: async (cmd, args, timeout, evt) => {
        calls.push({ cmd, args, evt });
        return cmd === 'AUTHENTICATE' ? { scopes: ['rpc', 'messages.read'] } : {};
      },
      close: () => {
        if (!socket.destroyed) { socket.destroyed = true; socket.emit('close'); }
      },
    };
    connections.push(rpc);
    return rpc;
  });
  return { bridge, calls, connections };
}

test('同時要求は一つの接続で認証を共有する', async t => {
  const { bridge, calls, connections } = fixture();
  t.after(() => bridge.close());
  await Promise.all([bridge.request('GET_GUILDS', {}), bridge.request('GET_VOICE_SETTINGS', {})]);
  assert.equal(connections.length, 1);
  assert.equal(calls.filter(call => call.cmd === 'AUTHENTICATE').length, 1);
  assert.equal(calls.some(call => call.cmd === 'AUTHORIZE'), false);
});

test('重複購読を直列化し、evtを引数から分離する', async t => {
  const { bridge, calls } = fixture();
  t.after(() => bridge.close());
  const value = { event: 'MESSAGE_CREATE', channel_id: '123456789012345678' };
  await Promise.all([bridge.subscription('SUBSCRIBE', value), bridge.subscription('SUBSCRIBE', value)]);
  const subscriptions = calls.filter(call => call.cmd === 'SUBSCRIBE');
  assert.equal(subscriptions.length, 1);
  assert.equal(subscriptions[0].evt, value.event);
  assert.deepEqual(subscriptions[0].args, { channel_id: value.channel_id });
  await bridge.subscription('UNSUBSCRIBE', value);
  assert.equal(bridge.subscriptions.size, 0);
});

test('切断後は次の要求で再接続し、購読の自動復元はせず欠落を知らせる', async t => {
  const { bridge, connections } = fixture();
  t.after(() => bridge.close());
  await bridge.subscription('SUBSCRIBE', { event: 'CURRENT_USER_UPDATE' });
  connections[0].onEvent({ event: 'CURRENT_USER_UPDATE', data: { username: 'example' } });
  connections[0].close();
  assert.equal(bridge.readEvents(0, 20).connected, false);
  await bridge.request('GET_GUILDS', {});
  const value = bridge.readEvents(0, 20);
  assert.equal(connections.length, 2);
  assert.equal(value.generation, 2);
  assert.equal(value.connectionGapOccurred, true);
  assert.deepEqual(value.subscriptions, []);
  assert.equal(value.events.at(-1).event, 'CONNECTION_CLOSED');
});

test('失敗した書き込みを再送しない', async t => {
  const { bridge, connections } = fixture();
  t.after(() => bridge.close());
  await bridge.connection();
  let writes = 0;
  connections[0].request = async () => { writes++; throw new Error('timeout'); };
  await assert.rejects(bridge.request('SET_ACTIVITY', {}));
  assert.equal(writes, 1);
});

test('期限切れによる接続更新でも購読欠落を一度だけ通知する', async t => {
  const { bridge } = fixture();
  t.after(() => bridge.close());
  await bridge.subscription('SUBSCRIBE', { event: 'CURRENT_USER_UPDATE' });
  bridge.expiresAt = 0;
  await bridge.request('GET_GUILDS', {});
  const value = bridge.readEvents(0, 20);
  assert.equal(value.connectionGapOccurred, true);
  assert.equal(value.generation, 2);
  assert.equal(value.events.filter(event => event.event === 'CONNECTION_CLOSED').length, 1);
  assert.deepEqual(value.subscriptions, []);
});

test('終了後に進行中の接続が完了してもソケットを残さない', async () => {
  let release;
  const auth = new Promise(resolve => { release = resolve; });
  let closed = false;
  const bridge = new Bridge({}, { credentials: async () => ({ expires_at: Infinity }) }, async () => ({
    request: () => auth,
    close: () => { closed = true; },
  }));
  const opening = bridge.connection();
  bridge.close();
  release({ scopes: ['rpc', 'messages.read'] });
  await assert.rejects(opening, { code: 'BRIDGE_CLOSED' });
  assert.equal(closed, true);
});

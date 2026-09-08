import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { Decoder, encode, Rpc } from '../src/ipc.js';

async function fixture(t, respond) {
  const dir = await mkdtemp(join(tmpdir(), 'discord-rpc-lifecycle-'));
  const path = join(dir, 'ipc');
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    const decoder = new Decoder();
    socket.on('data', chunk => {
      for (const frame of decoder.push(chunk)) respond(socket, frame);
    });
  });
  await new Promise(resolve => server.listen(path, resolve));
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true });
  });
  const rpc = new Rpc(path);
  t.after(() => rpc.close());
  return { rpc, path };
}

test('SUBSCRIBEのevtをトップレベルに送り、イベント本文を保持しない', async t => {
  const { rpc } = await fixture(t, (socket, { data }) => {
    assert.equal(data.evt, 'MESSAGE_CREATE');
    assert.deepEqual(data.args, { channel_id: 'test' });
    socket.write(Buffer.concat([
      encode(1, { cmd: 'DISPATCH', evt: 'MESSAGE_CREATE', data: { content: 'PRIVATE' } }),
      encode(1, { cmd: data.cmd, nonce: data.nonce, data: { evt: data.evt } }),
    ]));
  });
  await rpc.request('SUBSCRIBE', { channel_id: 'test' }, 1000, 'MESSAGE_CREATE');
  assert.deepEqual(rpc.eventCounts, { MESSAGE_CREATE: 1 });
  assert.equal(rpc.pending.size, 0);
  assert.equal(rpc.decoder.buffer.length, 0);
});

test('PINGは同じペイロードのPONGで応答する', async t => {
  let finish;
  const pong = new Promise(resolve => { finish = resolve; });
  const { rpc } = await fixture(t, (socket, frame) => {
    if (frame.opcode === 0) {
      socket.write(encode(3, { nonce: 'ping-test' }));
      socket.write(encode(1, { evt: 'READY', data: {} }));
    } else if (frame.opcode === 4) finish(frame.data);
  });
  await rpc.handshake('123456789012345678');
  assert.deepEqual(await pong, { nonce: 'ping-test' });
});

test('応答の順序が逆でもnonceで対応付ける', async t => {
  const requests = [];
  const { rpc } = await fixture(t, (socket, { data }) => {
    requests.push(data);
    if (requests.length === 2) for (const request of requests.reverse()) socket.write(encode(1, { nonce: request.nonce, data: { cmd: request.cmd } }));
  });
  const values = await Promise.all([rpc.request('GET_GUILD', {}), rpc.request('GET_CHANNELS', {})]);
  assert.deepEqual(values, [{ cmd: 'GET_GUILD' }, { cmd: 'GET_CHANNELS' }]);
});

test('応答がなければタイムアウトして待機を解除する', async t => {
  const { rpc } = await fixture(t, () => {});
  await assert.rejects(rpc.request('GET_GUILD', {}, 20), /タイムアウト/);
  assert.equal(rpc.pending.size, 0);
});

test('サーバー切断で待機中の要求が失敗する', async t => {
  const { rpc } = await fixture(t, socket => socket.destroy());
  await assert.rejects(rpc.request('GET_GUILD', {}), /閉じられました/);
  assert.equal(rpc.pending.size, 0);
});

test('不正JSONは本文を出力せず接続を閉じる', async t => {
  const { rpc } = await fixture(t, socket => {
    const header = Buffer.alloc(8);
    header.writeUInt32LE(1, 0);
    header.writeUInt32LE(7, 4);
    socket.write(Buffer.concat([header, Buffer.from('PRIVATE')]));
  });
  await assert.rejects(rpc.request('GET_GUILD', {}), { message: '不正なIPC応答' });
});

test('切断済み接続への要求は即座に拒否する', async t => {
  const { rpc } = await fixture(t, () => {});
  const closed = once(rpc.socket, 'close');
  rpc.close();
  await closed;
  await assert.rejects(rpc.request('GET_GUILD', {}), /閉じられ/);
  assert.equal(rpc.pending.size, 0);
});

test('UNSUBSCRIBEは購読時と同じイベントと対象を送る', async t => {
  const requests = [];
  const { rpc } = await fixture(t, (socket, { data }) => {
    requests.push({ cmd: data.cmd, evt: data.evt, args: data.args });
    socket.write(encode(1, { nonce: data.nonce, data: { evt: data.evt } }));
  });
  for (const cmd of ['SUBSCRIBE', 'UNSUBSCRIBE']) {
    await rpc.request(cmd, { channel_id: 'test' }, 1000, 'MESSAGE_CREATE');
  }
  assert.deepEqual(requests, [
    { cmd: 'SUBSCRIBE', evt: 'MESSAGE_CREATE', args: { channel_id: 'test' } },
    { cmd: 'UNSUBSCRIBE', evt: 'MESSAGE_CREATE', args: { channel_id: 'test' } },
  ]);
  assert.equal(rpc.pending.size, 0);
});

test('DiscordのCLOSEフレームで待機を解除し、理由の生データを出さない', async t => {
  const { rpc } = await fixture(t, socket => {
    socket.write(encode(2, { code: 4000, message: 'PRIVATE' }));
  });
  await assert.rejects(rpc.request('GET_GUILD', {}), { message: 'Discordが接続を終了しました' });
  assert.equal(rpc.socket.destroyed, true);
  assert.equal(rpc.pending.size, 0);
});

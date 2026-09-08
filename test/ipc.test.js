import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Decoder, encode, Rpc, rpcError } from '../src/ipc.js';

test('既知のOAuth原因だけを表示し秘密情報は含めない', () => {
  assert.equal(rpcError({ code: 5000, message: 'OAuth2 Error: invalid_scope: SECRET' }).message, 'RPCエラー 5000 (invalid_scope)');
  assert.equal(rpcError({ code: 'SECRET', message: 'SECRET' }).message, 'RPCエラー unknown');
});

test('分割・連結されたフレームを復元する', () => {
  const decoder = new Decoder();
  const frame = encode(1, { text: 'にゃ' });
  assert.deepEqual(decoder.push(frame.subarray(0, 5)), []);
  assert.deepEqual(decoder.push(Buffer.concat([frame.subarray(5), frame])), [
    { opcode: 1, data: { text: 'にゃ' } }, { opcode: 1, data: { text: 'にゃ' } },
  ]);
});

test('過大なフレームを拒否する', () => {
  const header = Buffer.alloc(8);
  header.writeUInt32LE(9 * 1024 * 1024, 4);
  assert.throws(() => new Decoder().push(header), /too large/);
});

test('実ソケット上でhandshakeと認可エラーを扱い、エラー本文を漏らさない', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'discord-rpc-test-'));
  const path = process.platform === 'win32' ? `\\\\.\\pipe\\discord-test-${randomUUID()}` : join(dir, 'ipc');
  const server = net.createServer(socket => {
    const decoder = new Decoder();
    socket.on('data', chunk => {
      for (const frame of decoder.push(chunk)) {
        if (frame.opcode === 0) socket.write(encode(1, { evt: 'READY', data: {} }));
        else {
          assert.deepEqual(frame.data.args.scopes, ['rpc', 'messages.read']);
          socket.write(encode(1, { evt: 'ERROR', nonce: frame.data.nonce, data: { code: 5000, message: 'SECRET' } }));
        }
      }
    });
  });
  await new Promise(resolve => server.listen(path, resolve));
  const rpc = new Rpc(path);
  try {
    await rpc.handshake('123456789012345678');
    await assert.rejects(rpc.authorize('123456789012345678'), { message: 'RPCエラー 5000' });
  } finally {
    rpc.close();
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true });
  }
});

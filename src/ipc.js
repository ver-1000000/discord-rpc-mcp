import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import { BridgeError } from './errors.js';

const MAX_FRAME = 8 * 1024 * 1024;

export function rpcError(data) {
  const code = Number.isInteger(data?.code) ? data.code : 'unknown';
  // Only emit known OAuth error names, never the remote message itself.
  const reason = typeof data?.message === 'string'
    ? data.message.match(/\b(invalid_scope|access_denied|invalid_client|invalid_grant|invalid_request|unauthorized_client)\b/)?.[1]
    : undefined;
  return new BridgeError('RPC_ERROR', `RPCエラー ${code}${reason ? ` (${reason})` : ''}`);
}

export function encode(opcode, data) {
  const body = Buffer.from(JSON.stringify(data));
  const header = Buffer.alloc(8);
  header.writeUInt32LE(opcode, 0);
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

export class Decoder {
  buffer = Buffer.alloc(0);
  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const frames = [];
    while (this.buffer.length >= 8) {
      const length = this.buffer.readUInt32LE(4);
      if (length > MAX_FRAME) throw new Error('IPC frame too large');
      if (this.buffer.length < 8 + length) break;
      frames.push({ opcode: this.buffer.readUInt32LE(0), data: JSON.parse(this.buffer.subarray(8, 8 + length).toString()) });
      this.buffer = this.buffer.length === 8 + length ? Buffer.alloc(0) : this.buffer.subarray(8 + length);
    }
    return frames;
  }
}

export async function discover(env = process.env) {
  // Remote shells may not inherit the desktop session's XDG_RUNTIME_DIR.
  const runtimeFallback = process.platform === 'linux' ? `/run/user/${process.getuid()}` : undefined;
  const roots = [...new Set([env.XDG_RUNTIME_DIR, env.TMPDIR, env.TMP, env.TEMP, '/tmp', runtimeFallback].filter(Boolean))];
  const paths = [];
  for (const root of roots) {
    for (let i = 0; i < 10; i++) {
      const path = join(root, `discord-ipc-${i}`);
      if (await stat(path).then(s => s.isSocket()).catch(() => false)) paths.push(path);
    }
  }
  return paths;
}

export class Rpc {
  onEvent = () => {};
  eventCounts = {};
  pending = new Map();
  decoder = new Decoder();
  constructor(path) {
    this.socket = net.createConnection(path);
    this.socket.on('error', () => this.fail(new Error('IPC接続エラー')));
    this.socket.on('close', () => this.fail(new Error('IPC接続が閉じられました')));
    this.socket.on('data', chunk => {
      try {
        for (const { opcode, data } of this.decoder.push(chunk)) {
          if (opcode === 3) { this.socket.write(encode(4, data)); continue; }
          if (opcode === 2) { this.fail(new Error('Discordが接続を終了しました')); this.close(); return; }
          if (opcode !== 1) continue;
          const key = data.evt === 'READY' ? 'ready' : data.nonce;
          const pending = this.pending.get(key);
          if (!pending) {
            if (data.cmd === 'DISPATCH' && typeof data.evt === 'string') this.onEvent({ event: data.evt, data: data.data });
            if (['MESSAGE_CREATE', 'MESSAGE_UPDATE', 'MESSAGE_DELETE', 'GUILD_STATUS'].includes(data.evt)) this.eventCounts[data.evt] = (this.eventCounts[data.evt] ?? 0) + 1;
            continue;
          }
          this.pending.delete(key);
          clearTimeout(pending.timer);
          // Remote error text can contain secrets; only expose a numeric code.
          if (data.evt === 'ERROR') pending.reject(rpcError(data.data));
          else pending.resolve(data.data);
        }
      } catch { this.fail(new Error('不正なIPC応答')); this.close(); }
    });
  }
  wait(key, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(key);
        reject(new BridgeError('RPC_TIMEOUT', 'RPC応答待ちタイムアウト。操作済みの可能性があるため、自動再送しません'));
        this.close();
      }, timeout);
      this.pending.set(key, { resolve, reject, timer });
    });
  }
  handshake(clientId) {
    if (this.socket.destroyed) return Promise.reject(new Error('IPC接続が閉じられています'));
    const result = this.wait('ready', 10000);
    this.socket.write(encode(0, { v: 1, client_id: clientId }));
    return result;
  }
  authorize(clientId) {
    return this.request('AUTHORIZE', { client_id: clientId, scopes: ['rpc', 'messages.read'] }, 120000);
  }
  request(cmd, args, timeout = 10000, evt) {
    if (this.socket.destroyed) return Promise.reject(new Error('IPC接続が閉じられています'));
    const nonce = randomUUID();
    const result = this.wait(nonce, timeout);
    this.socket.write(encode(1, { cmd, nonce, args, ...(evt ? { evt } : {}) }));
    return result;
  }
  fail(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
  close() { this.socket.destroy(); }
}

export async function connect(clientId, env = process.env) {
  const paths = env.DISCORD_RPC_PATH ? [env.DISCORD_RPC_PATH] : await discover(env);
  for (const path of paths) {
    const rpc = new Rpc(path);
    try {
      await rpc.handshake(clientId);
      return rpc;
    } catch { rpc.close(); }
  }
  throw new BridgeError('DISCORD_UNAVAILABLE', 'Start the Discord desktop app in this desktop session.');
}

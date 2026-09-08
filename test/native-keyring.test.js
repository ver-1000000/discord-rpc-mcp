import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NativeKeyring } from '../src/native-keyring.js';
import { discover } from '../src/ipc.js';

const attributes = { service: 'discord-rpc-mcp', purpose: 'oauth', client_id: '123456789012345678' };

for (const platform of ['win32', 'darwin']) {
  test(`${platform}: native credentials round-trip without external commands`, async () => {
    let secret;
    class AsyncEntry {
      constructor(service, account) {
        assert.equal(service, attributes.service);
        assert.equal(account, `oauth:${attributes.client_id}`);
      }
      async getSecret() { return secret; }
      async setSecret(value) { secret = value; }
      async deleteCredential() { secret = undefined; }
    }
    const store = new NativeKeyring({ platform, load: async () => ({ AsyncEntry }) });
    await assert.rejects(store.read(attributes), { code: 'LOGIN_REQUIRED' });
    await store.write(attributes, 'ねこ');
    assert.equal(await store.read(attributes), 'ねこ');
    await store.delete(attributes);
    await assert.rejects(store.read(attributes), { code: 'LOGIN_REQUIRED' });
  });
}

test('native module failures do not expose secret data', async () => {
  const store = new NativeKeyring({ platform: 'win32', load: async () => { throw new Error('SECRET'); } });
  await assert.rejects(store.read(attributes), error => error.code === 'KEYRING_UNAVAILABLE' && !error.message.includes('SECRET'));
});

test('Windows credential size limit is measured in bytes before writing', async () => {
  let written;
  const store = new NativeKeyring({ platform: 'win32', load: async () => ({ AsyncEntry: class {
    async setSecret(bytes) { written = bytes; }
  } }) });
  await store.write(attributes, 'a'.repeat(2560));
  assert.equal(written.length, 2560);
  await assert.rejects(store.write(attributes, '猫'.repeat(854)), { code: 'INVALID_CREDENTIALS' });
  assert.equal(written.length, 2560);
});

test('native backend cannot silently replace Linux Secret Service', async () => {
  await assert.rejects(new NativeKeyring({ platform: 'linux' }).read(attributes), { code: 'UNSUPPORTED_PLATFORM' });
});

test('Windows discovery returns all ten Discord named pipes', async () => {
  assert.deepEqual(await discover({}, 'win32'), Array.from({ length: 10 }, (_, i) => `\\\\.\\pipe\\discord-ipc-${i}`));
});

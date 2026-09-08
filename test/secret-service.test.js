import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Variant } from '@jellybrick/dbus-next';
import { SecretService } from '../src/secret-service.js';

const attributes = { service: 'discord-rpc-mcp', purpose: 'oauth', client_id: '123456789012345678' };
const item = '/collection/item';
const session = '/session/test';
function fixture(responses = {}) {
  const calls = [];
  const bus = new EventEmitter();
  let disconnected = false;
  bus.disconnect = () => { disconnected = true; };
  bus.call = async message => {
    calls.push(message);
    const response = responses[message.member] ?? {
      SearchItems: [[item], []], OpenSession: [new Variant('s', ''), session],
      GetSecret: [[session, [], Buffer.from('SECRET'), 'application/json']],
      ReadAlias: ['/collection'], Get: [new Variant('b', false)],
      SetSecret: [], CreateItem: [item, '/'], Delete: ['/'],
    }[message.member];
    if (response instanceof Error) throw response;
    return { body: response };
  };
  const service = new SecretService({ busFactory: () => bus });
  return { service, bus, calls, closed: () => disconnected };
}

test('既存属性で検索して秘密を読み取り、接続を閉じる', async () => {
  const f = fixture();
  assert.equal(await f.service.read(attributes), 'SECRET');
  assert.deepEqual(f.calls.map(c => c.member), ['SearchItems', 'OpenSession', 'GetSecret']);
  assert.deepEqual(f.calls[0].body, [attributes]);
  assert.equal(f.calls[0].signature, 'a{ss}');
  assert.deepEqual(f.calls[2].body, [session]);
  assert.ok(f.closed());
});

test('既存項目を削除せず直接更新する', async () => {
  const f = fixture();
  await f.service.write(attributes, 'NEW_SECRET');
  assert.deepEqual(f.calls.map(c => c.member), ['SearchItems', 'OpenSession', 'SetSecret']);
  assert.equal(f.calls[2].signature, '(oayays)');
  assert.equal(f.calls[2].body[0][2].toString(), 'NEW_SECRET');
  assert.ok(f.closed());
});

test('新規項目は既定コレクションに互換属性で作成する', async () => {
  const f = fixture({ SearchItems: [[], []] });
  await f.service.write(attributes, 'SECRET');
  const call = f.calls.at(-1);
  assert.equal(call.member, 'CreateItem');
  assert.equal(call.signature, 'a{sv}(oayays)b');
  assert.deepEqual(call.body[0]['org.freedesktop.Secret.Item.Attributes'].value, attributes);
  assert.equal(call.body[2], true);
});

test('ログアウトは一致した項目だけ削除し、未保存なら成功する', async () => {
  for (const items of [[item], []]) {
    const f = fixture({ SearchItems: [items, []] });
    await f.service.delete(attributes);
    assert.deepEqual(f.calls.map(c => c.member), items.length ? ['SearchItems', 'Delete'] : ['SearchItems']);
    assert.ok(f.closed());
  }
});

test('未保存・ロック・重複を区別し、秘密を取得も変更もしない', async () => {
  for (const [result, code] of [
    [[[], []], 'LOGIN_REQUIRED'],
    [[[], [item]], 'KEYRING_LOCKED'],
    [[[item, '/other'], []], 'KEYRING_AMBIGUOUS'],
  ]) {
    const f = fixture({ SearchItems: result });
    await assert.rejects(f.service.read(attributes), { code });
    assert.equal(f.calls.length, 1);
    assert.ok(f.closed());
  }
});

test('コレクション未設定・ロック・対話要求で勝手に作成や認可をしない', async () => {
  for (const [responses, code] of [
    [{ ReadAlias: ['/'] }, 'KEYRING_NOT_CONFIGURED'],
    [{ Get: [new Variant('b', true)] }, 'KEYRING_LOCKED'],
    [{ CreateItem: ['/', '/prompt'] }, 'KEYRING_LOCKED'],
  ]) {
    const f = fixture({ SearchItems: [[], []], ...responses });
    await assert.rejects(f.service.write(attributes, 'SECRET'), { code });
    assert.ok(!f.calls.some(c => ['Unlock', 'Prompt', 'CreateCollection'].includes(c.member)));
    assert.ok(f.closed());
  }
  const f = fixture({ Delete: ['/prompt'] });
  await assert.rejects(f.service.delete(attributes), { code: 'KEYRING_LOCKED' });
});

test('巨大な保存データを拒否する', async () => {
  const f = fixture({ GetSecret: [[session, [], Buffer.alloc(65537), 'application/json']] });
  await assert.rejects(f.service.read(attributes), { code: 'LOGIN_REQUIRED' });
  await assert.rejects(fixture().service.write(attributes, 'x'.repeat(65537)), { code: 'INVALID_CREDENTIALS' });
});

test('D-Bus失敗を秘密なしの案内へ変換する', async () => {
  const f = fixture({ SearchItems: new Error('PRIVATE SECRET') });
  await assert.rejects(f.service.read(attributes), error => error.code === 'KEYRING_UNAVAILABLE' && !error.message.includes('PRIVATE'));
  assert.ok(f.closed());
});

test('無応答やソケット障害でも接続を閉じて失敗する', async () => {
  for (const socketError of [false, true]) {
    const f = fixture();
    f.bus.call = () => new Promise(() => {});
    const service = new SecretService({ busFactory: () => f.bus, timeout: 10 });
    const pending = service.read(attributes);
    if (socketError) f.bus.emit('error', new Error('PRIVATE SECRET'));
    await assert.rejects(pending, { code: 'KEYRING_UNAVAILABLE' });
    assert.ok(f.closed());
  }
});

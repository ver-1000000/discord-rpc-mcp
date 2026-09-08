import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventBuffer } from '../src/events.js';
import { subscriptionSchema } from '../src/commands.js';

test('イベントは件数上限内に収め、失われた範囲を明示する', () => {
  const events = new EventBuffer(2);
  for (let i = 0; i < 3; i++) events.push({ event: 'MESSAGE_CREATE', data: { i } });
  const first = events.read(0, 1);
  assert.equal(first.gap, true);
  assert.equal(first.droppedTotal, 1);
  assert.equal(first.nextCursor, 2);
  assert.equal(first.hasMore, true);
  const next = events.read(first.nextCursor);
  assert.equal(next.gap, false);
  assert.equal(next.events[0].data.i, 2);
  assert.equal(next.historyComplete, false);
  assert.equal(events.read(next.nextCursor).events.length, 0);
});

test('過大イベントはメモリへ保持せずカーソルで読み飛ばしを検出できる', () => {
  const events = new EventBuffer(100, 300);
  events.push({ event: 'MESSAGE_CREATE', data: 'x'.repeat(1000) });
  assert.equal(events.bytes, 0);
  const value = events.read();
  assert.equal(value.gap, true);
  assert.equal(value.nextCursor, 1);
  assert.equal(events.read(1).gap, false);
});

test('イベントの対象を厳密に検証する', () => {
  const id = '123456789012345678';
  assert.equal(subscriptionSchema.safeParse({ event: 'MESSAGE_CREATE', channel_id: id }).success, true);
  assert.equal(subscriptionSchema.safeParse({ event: 'GUILD_STATUS', guild_id: id }).success, true);
  assert.equal(subscriptionSchema.safeParse({ event: 'CURRENT_USER_UPDATE' }).success, true);
  for (const input of [
    { event: 'AUTHORIZE' },
    { event: 'MESSAGE_CREATE' },
    { event: 'GUILD_STATUS', channel_id: id },
    { event: 'CURRENT_USER_UPDATE', guild_id: id },
    { event: 'MESSAGE_CREATE', channel_id: id, guild_id: id },
  ]) assert.equal(subscriptionSchema.safeParse(input).success, false);
});

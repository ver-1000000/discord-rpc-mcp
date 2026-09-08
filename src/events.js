import { randomUUID } from 'node:crypto';

export class EventBuffer {
  streamId = randomUUID();
  items = [];
  sequence = 0;
  bytes = 0;
  dropped = 0;
  droppedThrough = 0;
  constructor(maxItems = 100, maxBytes = 1024 * 1024) {
    Object.assign(this, { maxItems, maxBytes });
  }
  push(event) {
    const value = { sequence: ++this.sequence, receivedAt: new Date().toISOString(), ...event };
    const size = Buffer.byteLength(JSON.stringify(value));
    if (size > this.maxBytes) {
      this.dropped++;
      this.droppedThrough = value.sequence;
      return;
    }
    this.items.push({ value, size });
    this.bytes += size;
    while (this.items.length > this.maxItems || this.bytes > this.maxBytes) {
      const removed = this.items.shift();
      this.bytes -= removed.size;
      this.dropped++;
      this.droppedThrough = Math.max(this.droppedThrough, removed.value.sequence);
    }
  }
  read(after = 0, limit = 20) {
    const values = this.items.filter(item => item.value.sequence > after);
    const events = values.slice(0, limit).map(item => item.value);
    const hasMore = values.length > events.length;
    return {
      streamId: this.streamId,
      events,
      nextCursor: hasMore ? events.at(-1).sequence : Math.max(after, this.sequence),
      hasMore,
      droppedTotal: this.dropped,
      gap: after < this.droppedThrough,
      historyComplete: false,
    };
  }
  clear() {
    this.items = [];
    this.bytes = 0;
  }
}

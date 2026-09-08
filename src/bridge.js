import { connect } from './ipc.js';
import { authenticate } from './auth.js';
import { BridgeError } from './errors.js';
import { EventBuffer } from './events.js';
import { eventNames } from './commands.js';

export class Bridge {
  rpc;
  opening;
  closed = false;
  expiresAt = 0;
  subscriptions = new Map();
  subscriptionChain = Promise.resolve();
  events = new EventBuffer();
  generation = 0;
  disconnected = false;
  disconnectedRpc;
  constructor(config, auth, connector = connect) {
    Object.assign(this, { config, auth, connector });
  }
  async connection() {
    if (this.closed) throw new BridgeError('BRIDGE_CLOSED', 'The bridge is shutting down.');
    if (this.rpc && !this.rpc.socket.destroyed && this.expiresAt > Date.now() + 60000) return this.rpc;
    if (!this.opening) {
      this.opening = this.open().finally(() => { this.opening = undefined; });
    }
    return this.opening;
  }
  async open() {
    if (this.rpc) this.onDisconnect(this.rpc);
    this.rpc?.close();
    const credentials = await this.auth.credentials();
    const rpc = await this.connector(this.config.clientId, this.config.env);
    try {
      await authenticate(rpc, credentials);
      if (this.closed) throw new BridgeError('BRIDGE_CLOSED', 'The bridge is shutting down.');
      this.subscriptions.clear();
      this.generation++;
      this.rpc = rpc;
      this.expiresAt = credentials.expires_at;
      rpc.onEvent = event => {
        if (eventNames.includes(event.event)) this.events.push({ ...event, generation: this.generation });
      };
      rpc.socket.once('close', () => this.onDisconnect(rpc));
      return rpc;
    } catch (error) { rpc.close(); throw error; }
  }
  onDisconnect(rpc) {
    if (this.closed || this.rpc !== rpc || this.disconnectedRpc === rpc) return;
    this.disconnectedRpc = rpc;
    this.subscriptions.clear();
    this.disconnected = true;
    this.events.push({ event: 'CONNECTION_CLOSED', generation: this.generation, data: { resubscribeRequired: true } });
  }
  async request(cmd, args) {
    const rpc = await this.connection();
    return rpc.request(cmd, args);
  }
  subscription(cmd, value) {
    const execute = async () => {
      const rpc = await this.connection();
      const { event, ...args } = value;
      const key = JSON.stringify([event, args.channel_id ?? args.guild_id ?? null]);
      const existing = this.subscriptions.has(key);
      if ((cmd === 'SUBSCRIBE' && existing) || (cmd === 'UNSUBSCRIBE' && !existing)) {
        return { event, subscribed: existing, changed: false };
      }
      if (cmd === 'SUBSCRIBE' && this.subscriptions.size >= 100) {
        throw new BridgeError('SUBSCRIPTION_LIMIT', 'Unsubscribe from an event before adding another subscription.');
      }
      const data = await rpc.request(cmd, args, 10000, event);
      if (rpc.socket.destroyed) throw new BridgeError('DISCONNECTED', 'Discord disconnected. Subscribe again after reconnecting.');
      if (cmd === 'SUBSCRIBE') this.subscriptions.set(key, value);
      else this.subscriptions.delete(key);
      return { data, subscribed: cmd === 'SUBSCRIBE', changed: true, generation: this.generation };
    };
    const result = this.subscriptionChain.then(execute);
    this.subscriptionChain = result.catch(() => {});
    return result;
  }
  readEvents(after, limit) {
    return {
      ...this.events.read(after, limit),
      connected: !!this.rpc && !this.rpc.socket.destroyed,
      generation: this.generation,
      connectionGapOccurred: this.disconnected,
      subscriptions: [...this.subscriptions.values()],
    };
  }
  close() {
    this.closed = true;
    this.rpc?.close();
    this.subscriptions.clear();
    this.events.clear();
  }
}

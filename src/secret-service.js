import { Message, Variant, sessionBus } from '@jellybrick/dbus-next';
import { BridgeError } from './errors.js';

const root = '/org/freedesktop/secrets';
const prefix = 'org.freedesktop.Secret.';
const unavailable = () => new BridgeError('KEYRING_UNAVAILABLE', 'Start a Secret Service keyring (such as GNOME Keyring or KWallet) in your desktop session.');
const locked = () => new BridgeError('KEYRING_LOCKED', 'Unlock your desktop keyring and retry.');

export class SecretService {
  constructor({ busFactory = sessionBus, env = process.env, timeout = 30000 } = {}) {
    this.busFactory = busFactory;
    this.env = env;
    this.timeout = timeout;
  }

  async run(operation, attributes, value) {
    if (process.platform !== 'linux') {
      throw new BridgeError('UNSUPPORTED_PLATFORM', 'Credential storage currently supports Linux Secret Service.');
    }
    let bus;
    let timer;
    try {
      bus = this.busFactory({ busAddress: this.env.DBUS_SESSION_BUS_ADDRESS ?? `unix:path=/run/user/${process.getuid()}/bus`, authMethods: ['EXTERNAL'] });
      const failure = new Promise((_, reject) => {
        bus.on('error', () => reject(unavailable()));
        timer = setTimeout(() => reject(unavailable()), this.timeout);
      });
      const call = async (path, iface, member, signature = '', body = []) => {
        const response = await bus.call(new Message({ destination: 'org.freedesktop.secrets', path, interface: iface, member, signature, body }));
        return response.body;
      };
      const work = async () => {
        const [items, lockedItems] = await call(root, prefix + 'Service', 'SearchItems', 'a{ss}', [attributes]);
        if (items.length + lockedItems.length > 1) {
          throw new BridgeError('KEYRING_AMBIGUOUS', 'Multiple matching credentials exist. Remove duplicate entries using your keyring manager.');
        }
        if (lockedItems.length) throw locked();
        const item = items[0];
        if (operation === 'delete') {
          if (item) {
            const [prompt] = await call(item, prefix + 'Item', 'Delete');
            if (prompt !== '/') throw locked();
          }
          return;
        }
        if (operation === 'read' && !item) {
          throw new BridgeError('LOGIN_REQUIRED', 'Run discord-rpc-mcp login first.');
        }
        const [, session] = await call(root, prefix + 'Service', 'OpenSession', 'sv', ['plain', new Variant('s', '')]);
        if (operation === 'read') {
          const [secret] = await call(item, prefix + 'Item', 'GetSecret', 'o', [session]);
          if (secret[2].length > 65536) throw new BridgeError('LOGIN_REQUIRED', 'Stored credentials are invalid. Run discord-rpc-mcp login.');
          return Buffer.from(secret[2]).toString('utf8');
        }
        if (Buffer.byteLength(value) > 65536) throw new BridgeError('INVALID_CREDENTIALS', 'Credentials exceed the storage limit.');
        const secret = [session, [], Buffer.from(value), 'application/json'];
        if (item) {
          await call(item, prefix + 'Item', 'SetSecret', '(oayays)', [secret]);
          return;
        }
        const [collection] = await call(root, prefix + 'Service', 'ReadAlias', 's', ['default']);
        if (collection === '/') throw new BridgeError('KEYRING_NOT_CONFIGURED', 'Create a default collection in your desktop keyring manager.');
        const [state] = await call(collection, 'org.freedesktop.DBus.Properties', 'Get', 'ss', [prefix + 'Collection', 'Locked']);
        if (state.value) throw locked();
        const [, prompt] = await call(collection, prefix + 'Collection', 'CreateItem', 'a{sv}(oayays)b', [{
          [prefix + 'Item.Label']: new Variant('s', 'Discord RPC MCP OAuth'),
          [prefix + 'Item.Attributes']: new Variant('a{ss}', attributes),
        }, secret, true]);
        if (prompt !== '/') throw locked();
      };
      return await Promise.race([work(), failure]);
    } catch (error) {
      if (error instanceof BridgeError) throw error;
      if (error?.type === prefix + 'Error.IsLocked') throw locked();
      throw unavailable();
    } finally {
      clearTimeout(timer);
      bus?.disconnect();
    }
  }

  read(attributes) { return this.run('read', attributes); }
  write(attributes, value) { return this.run('write', attributes, value); }
  delete(attributes) { return this.run('delete', attributes); }
}

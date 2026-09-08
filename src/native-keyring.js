import { BridgeError } from './errors.js';

export class NativeKeyring {
  constructor({ platform = process.platform, load = () => import('@napi-rs/keyring') } = {}) {
    this.platform = platform;
    this.load = load;
  }
  async run(operation, attributes, value) {
    if (!['win32', 'darwin'].includes(this.platform)) {
      throw new BridgeError('UNSUPPORTED_PLATFORM', 'Native credential storage supports Windows and macOS.');
    }
    try {
      // Windows Credential Manager limits a generic credential to 2560 bytes.
      // setSecret avoids password encoding expansion and stores the JSON as UTF-8.
      const bytes = value === undefined ? undefined : Buffer.from(value, 'utf8');
      if (bytes && bytes.length > (this.platform === 'win32' ? 2560 : 65536)) {
        throw new BridgeError('INVALID_CREDENTIALS', 'Credentials exceed the operating system storage limit.');
      }
      const { AsyncEntry } = await this.load();
      const entry = new AsyncEntry(attributes.service, `${attributes.purpose}:${attributes.client_id}`);
      if (operation === 'write') { await entry.setSecret(bytes); return; }
      if (operation === 'delete') { await entry.deleteCredential(); return; }
      const secret = await entry.getSecret();
      if (secret == null) throw new BridgeError('LOGIN_REQUIRED', 'Run discord-rpc-mcp login first.');
      if (secret.length > 65536) throw new BridgeError('LOGIN_REQUIRED', 'Stored credentials are invalid. Run discord-rpc-mcp login.');
      return Buffer.from(secret).toString('utf8');
    } catch (error) {
      if (error instanceof BridgeError) throw error;
      throw new BridgeError('KEYRING_UNAVAILABLE', 'Allow access to your operating system credential store and retry.');
    }
  }
  read(attributes) { return this.run('read', attributes); }
  write(attributes, value) { return this.run('write', attributes, value); }
  delete(attributes) { return this.run('delete', attributes); }
}

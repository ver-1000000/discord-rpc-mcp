import { spawn } from 'node:child_process';
import { BridgeError } from './errors.js';

function run(args, input) {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'linux') {
      reject(new BridgeError('UNSUPPORTED_PLATFORM', 'Credential storage currently supports Linux Secret Service.'));
      return;
    }
    const env = { ...process.env };
    env.DBUS_SESSION_BUS_ADDRESS ??= `unix:path=/run/user/${process.getuid()}/bus`;
    const child = spawn('secret-tool', args, { env, stdio: ['pipe', 'pipe', 'ignore'] });
    const chunks = [];
    let length = 0;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 30000);
    child.stdout.on('data', chunk => {
      length += chunk.length;
      if (length > 65536) child.kill('SIGKILL');
      else chunks.push(chunk);
    });
    child.stdin.on('error', () => {});
    child.once('error', () => {
      clearTimeout(timer);
      reject(new BridgeError('KEYRING_UNAVAILABLE', 'Install secret-tool and unlock your desktop keyring.'));
    });
    child.once('close', code => {
      clearTimeout(timer);
      if (code !== 0 || timedOut || length > 65536) {
        reject(new BridgeError('KEYRING_UNAVAILABLE', 'Unlock your desktop keyring and run discord-rpc-mcp login.'));
      } else resolve(Buffer.concat(chunks).toString().trim());
    });
    child.stdin.end(input ?? '');
  });
}

export function validateCredentials(value) {
  if (!value || typeof value.access_token !== 'string' || !value.access_token ||
      !Number.isFinite(value.expires_at) || value.expires_at <= 0 ||
      (value.refresh_token !== undefined && typeof value.refresh_token !== 'string') ||
      (value.scopes !== undefined && (!Array.isArray(value.scopes) || !value.scopes.every(scope => typeof scope === 'string')))) {
    throw new BridgeError('LOGIN_REQUIRED', 'Run discord-rpc-mcp login to save valid credentials.');
  }
  return {
    access_token: value.access_token,
    expires_at: value.expires_at,
    ...(value.refresh_token ? { refresh_token: value.refresh_token } : {}),
    ...(value.scopes ? { scopes: [...new Set(value.scopes)] } : {}),
  };
}

export class CredentialStore {
  constructor(clientId, runner = run) {
    if (!/^\d{17,20}$/.test(clientId)) throw new BridgeError('INVALID_CONFIG', 'Invalid application ID.');
    this.attributes = ['service', 'discord-rpc-mcp', 'purpose', 'oauth', 'client_id', clientId];
    this.runner = runner;
  }
  async load() {
    const raw = await this.runner(['lookup', ...this.attributes]);
    let value;
    try { value = JSON.parse(raw); }
    catch { throw new BridgeError('LOGIN_REQUIRED', 'Run discord-rpc-mcp login first.'); }
    return validateCredentials(value);
  }
  async save(value) {
    await this.runner(['store', '--label=Discord RPC MCP OAuth', ...this.attributes], JSON.stringify(validateCredentials(value)));
  }
  async clear() {
    await this.runner(['clear', ...this.attributes]);
  }
}

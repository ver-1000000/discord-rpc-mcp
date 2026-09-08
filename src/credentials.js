import { SecretService } from './secret-service.js';
import { BridgeError } from './errors.js';

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
  constructor(clientId, backend = new SecretService()) {
    if (!/^\d{17,20}$/.test(clientId)) throw new BridgeError('INVALID_CONFIG', 'Invalid application ID.');
    this.attributes = { service: 'discord-rpc-mcp', purpose: 'oauth', client_id: clientId };
    this.backend = backend;
  }
  async load() {
    const raw = await this.backend.read(this.attributes);
    let value;
    try { value = JSON.parse(raw); }
    catch { throw new BridgeError('LOGIN_REQUIRED', 'Run discord-rpc-mcp login first.'); }
    return validateCredentials(value);
  }
  async save(value) {
    await this.backend.write(this.attributes, JSON.stringify(validateCredentials(value)));
  }
  async clear() {
    await this.backend.delete(this.attributes);
  }
}

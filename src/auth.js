import { BridgeError } from './errors.js';
import { validateCredentials } from './credentials.js';

import { DEFAULT_SCOPES as SCOPES, requireScopes } from './scopes.js';

export async function tokenGrant(config, grant, fetcher = fetch, now = Date.now) {
  if (!config.clientSecret) {
    throw new BridgeError('CLIENT_SECRET_REQUIRED', 'Set DISCORD_CLIENT_SECRET for login or token renewal.');
  }
  let response;
  try {
    response = await fetcher('https://discord.com/api/oauth2/token', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...grant }),
    });
  } catch { throw new BridgeError('OAUTH_UNAVAILABLE', 'Could not reach the Discord OAuth endpoint.'); }
  let data;
  try { data = await response.json(); }
  catch { throw new BridgeError('OAUTH_INVALID_RESPONSE', 'Discord returned an invalid OAuth response.'); }
  if (!response.ok) {
    throw new BridgeError('OAUTH_REJECTED', 'Discord rejected the OAuth grant. Check your application settings or run login again.');
  }
  if (!Number.isFinite(data?.expires_in) || data.expires_in <= 0) {
    throw new BridgeError('OAUTH_INVALID_RESPONSE', 'Discord returned an invalid token lifetime.');
  }
  return validateCredentials({
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? grant.refresh_token,
    expires_at: now() + data.expires_in * 1000,
    ...(typeof data.scope === 'string' ? { scopes: data.scope.split(/\s+/).filter(Boolean) } : {}),
  });
}

export async function authenticate(rpc, credentials, required = SCOPES) {
  const data = await rpc.request('AUTHENTICATE', { access_token: credentials.access_token });
  if (!Array.isArray(data?.scopes) || !data.scopes.every(scope => typeof scope === 'string')) {
    throw new BridgeError('SCOPE_REQUIRED', 'Discord did not return granted scopes. Run login again.');
  }
  requireScopes(data.scopes, required);
  return data.scopes;
}

export async function login(config, store, connect, fetcher = fetch) {
  if (!config.clientSecret) throw new BridgeError('CLIENT_SECRET_REQUIRED', 'Set DISCORD_CLIENT_SECRET before login.');
  const rpc = await connect(config.clientId, config.env);
  try {
    const scopes = config.scopes ?? SCOPES;
    const data = await rpc.request('AUTHORIZE', { client_id: config.clientId, scopes }, 120000);
    if (typeof data?.code !== 'string' || !data.code) {
      throw new BridgeError('AUTHORIZATION_FAILED', 'Discord did not return an authorization code.');
    }
    const credentials = await tokenGrant(config, {
      grant_type: 'authorization_code', code: data.code, redirect_uri: config.redirectUri,
    }, fetcher);
    credentials.scopes = await authenticate(rpc, credentials, scopes);
    await store.save(credentials);
    return { authenticated: true, scopes: credentials.scopes, expiresAt: new Date(credentials.expires_at).toISOString() };
  } finally { rpc.close(); }
}

export class Auth {
  pending;
  constructor(config, store, fetcher = fetch, now = Date.now) {
    Object.assign(this, { config, store, fetcher, now });
  }
  async credentials() {
    if (!this.pending) this.pending = this.load().finally(() => { this.pending = undefined; });
    return this.pending;
  }
  async load() {
    const value = await this.store.load();
    if (value.scopes) requireScopes(value.scopes, this.config.scopes ?? SCOPES);
    if (value.expires_at > this.now() + 60000) return value;
    if (!value.refresh_token) throw new BridgeError('LOGIN_REQUIRED', 'Your authorization expired. Run login again.');
    const renewed = await tokenGrant(this.config, {
      grant_type: 'refresh_token', refresh_token: value.refresh_token,
    }, this.fetcher, this.now);
    renewed.scopes ??= value.scopes;
    if (renewed.scopes) requireScopes(renewed.scopes, this.config.scopes ?? SCOPES);
    await this.store.save(renewed);
    return renewed;
  }
}

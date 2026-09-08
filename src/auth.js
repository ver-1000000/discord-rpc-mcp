import { BridgeError } from './errors.js';
import { validateCredentials } from './credentials.js';

export const SCOPES = ['rpc', 'messages.read'];

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
  });
}

export async function authenticate(rpc, credentials) {
  const data = await rpc.request('AUTHENTICATE', { access_token: credentials.access_token });
  if (!SCOPES.every(scope => data?.scopes?.includes(scope))) {
    throw new BridgeError('SCOPE_REQUIRED', 'The saved authorization needs rpc and messages.read. Run login again.');
  }
}

export async function login(config, store, connect, fetcher = fetch) {
  if (!config.clientSecret) throw new BridgeError('CLIENT_SECRET_REQUIRED', 'Set DISCORD_CLIENT_SECRET before login.');
  const rpc = await connect(config.clientId, config.env);
  try {
    const data = await rpc.request('AUTHORIZE', { client_id: config.clientId, scopes: SCOPES }, 120000);
    if (typeof data?.code !== 'string' || !data.code) {
      throw new BridgeError('AUTHORIZATION_FAILED', 'Discord did not return an authorization code.');
    }
    const credentials = await tokenGrant(config, {
      grant_type: 'authorization_code', code: data.code, redirect_uri: config.redirectUri,
    }, fetcher);
    await authenticate(rpc, credentials);
    await store.save(credentials);
    return { authenticated: true, expiresAt: new Date(credentials.expires_at).toISOString() };
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
    if (value.expires_at > this.now() + 60000) return value;
    if (!value.refresh_token) throw new BridgeError('LOGIN_REQUIRED', 'Your authorization expired. Run login again.');
    const renewed = await tokenGrant(this.config, {
      grant_type: 'refresh_token', refresh_token: value.refresh_token,
    }, this.fetcher, this.now);
    await this.store.save(renewed);
    return renewed;
  }
}

import { join } from 'node:path';
import { config } from './config.js';
import { CredentialStore } from './credentials.js';
import { configDirectory, readLocal, writeLocal } from './local-storage.js';
import { Auth, authenticate, login } from './auth.js';
import { connect } from './ipc.js';
import { Bridge } from './bridge.js';
import { BridgeError } from './errors.js';

export class Runtime {
  constructor({ env = process.env, directory = configDirectory(env), storeFactory, connector = connect, fetcher = fetch } = {}) {
    Object.assign(this, { env, directory, connector, fetcher });
    this.storeFactory = storeFactory ?? (id => new CredentialStore(id));
    this.settings = config({}, { optional: true });
    this.bridge = new Bridge(this.settings, { credentials: () => {
      if (this.settingUp) throw new BridgeError('SETUP_BUSY', 'Setup is in progress. Retry after it completes.');
      return this.auth().credentials();
    } }, connector);
  }
  async initialize() {
    if (['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI', 'DISCORD_ALLOW_CONTROL', 'DISCORD_SCOPES', 'DISCORD_CREDENTIAL_STORAGE'].some(key => this.env[key] !== undefined)) {
      throw new BridgeError('INVALID_CONFIG', 'Environment-based Discord setup is no longer supported. Remove the old overrides and use the setup tool.');
    }
    const raw = await readLocal(join(this.directory, 'settings.json'));
    let saved = {};
    try { if (raw !== undefined) saved = this.validate(JSON.parse(raw)); }
    catch (error) {
      if (error instanceof BridgeError) throw error;
      throw new BridgeError('INVALID_CONFIG', 'Saved settings are invalid.');
    }
    this.apply(config({
      ...this.env,
      DISCORD_CLIENT_ID: saved.clientId,
      DISCORD_REDIRECT_URI: saved.redirectUri,
      DISCORD_ALLOW_CONTROL: saved.allowControl ? '1' : '0',
      DISCORD_SCOPES: saved.scopes?.join(' '),
      DISCORD_CREDENTIAL_STORAGE: saved.storage,
    }, { optional: true }));
  }
  validate(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).some(key => !['clientId', 'redirectUri', 'allowControl', 'scopes', 'storage'].includes(key)) ||
        !/^\d{17,20}$/.test(value.clientId ?? '') || typeof value.allowControl !== 'boolean' ||
        typeof value.redirectUri !== 'string' || value.redirectUri.length > 2048 || value.storage !== 'keyring' ||
        !Array.isArray(value.scopes) || !value.scopes.every(scope => typeof scope === 'string')) {
      throw new BridgeError('INVALID_CONFIG', 'Invalid setup settings.');
    }
    try {
      const uri = new URL(value.redirectUri);
      if (!['http:', 'https:'].includes(uri.protocol) || uri.username || uri.password || uri.hash) throw new Error();
    } catch { throw new BridgeError('INVALID_CONFIG', 'Enter a valid HTTP(S) redirect URL without credentials or a fragment.'); }
    config({ DISCORD_CLIENT_ID: value.clientId, DISCORD_SCOPES: value.scopes.join(' ') });
    return value;
  }
  apply(settings) {
    if (this.bridge.rpc) this.bridge.onDisconnect(this.bridge.rpc);
    this.bridge.rpc?.close();
    this.bridge.rpc = undefined;
    this.bridge.expiresAt = 0;
    this.bridge.subscriptions.clear();
    Object.assign(this.settings, settings);
    this.currentAuth = undefined;
    this.onConfigured?.();
  }
  store(settings = this.settings) {
    if (!settings.clientId) throw new BridgeError('SETUP_REQUIRED', 'Ask your agent to call setup, then enter credentials in the local browser page.');
    return this.storeFactory(settings.clientId, settings.storage);
  }
  auth() { return this.currentAuth ??= new Auth(this.settings, this.store(), this.fetcher); }
  async status() {
    if (!this.settings.clientId) return { configured: false, credentialsStored: false };
    try {
      const value = await this.store().load();
      return {
        configured: true, credentialsStored: true, storage: this.settings.storage,
        expired: value.expires_at <= Date.now(), expiresAt: new Date(value.expires_at).toISOString(),
        canRefresh: !!value.refresh_token,
        scopes: value.scopes ?? null,
        missingScopes: value.scopes ? this.settings.scopes.filter(scope => !value.scopes.includes(scope)) : null,
      };
    } catch (error) {
      if (error.code === 'LOGIN_REQUIRED') return { configured: true, credentialsStored: false, storage: this.settings.storage };
      throw error;
    }
  }
  async login() {
    const store = this.store();
    let previous;
    try { previous = await store.load(); }
    catch (error) { if (error.code !== 'LOGIN_REQUIRED') throw error; }
    const clientSecret = this.settings.clientSecret ?? previous?.client_secret;
    return login({ ...this.settings, clientSecret }, {
      save: value => store.save({ ...value, ...(clientSecret ? { client_secret: clientSecret } : {}) }),
    }, this.connector, this.fetcher);
  }
  async setup(input, { isActive = () => true } = {}) {
    if (this.settingUp || this.bridge.opening) throw new BridgeError('SETUP_BUSY', 'A connection or setup is already in progress. Retry when it finishes.');
    this.settingUp = true;
    let stage = 'validation';
    let requestedScopes;
    try {
      const saved = this.validate({ clientId: input.clientId, redirectUri: input.redirectUri,
        allowControl: input.allowControl, scopes: input.scopes, storage: input.storage ?? 'keyring' });
      if (input.clientSecret !== undefined &&
          (typeof input.clientSecret !== 'string' || !input.clientSecret.trim() || input.clientSecret.length > 4096)) {
        throw new BridgeError('INVALID_CONFIG', 'Invalid client secret.');
      }
      const settings = config({ ...this.env, DISCORD_CLIENT_ID: saved.clientId,
        DISCORD_REDIRECT_URI: saved.redirectUri,
        DISCORD_ALLOW_CONTROL: saved.allowControl ? '1' : '0', DISCORD_SCOPES: saved.scopes.join(' '),
        DISCORD_CREDENTIAL_STORAGE: saved.storage });
      settings.clientSecret = input.clientSecret;
      const store = this.store(settings);
      requestedScopes = settings.scopes;
      let credentials;
      const staging = {
        load: async () => {
          const value = await store.load();
          settings.clientSecret ??= value.client_secret;
          return value;
        },
        save: async value => { credentials = value; },
      };
      let authenticated = false;
      try {
        stage = 'load_credentials';
        credentials = await new Auth(settings, staging, this.fetcher).credentials();
        stage = 'connect';
        const rpc = await this.connector(settings.clientId, settings.env);
        stage = 'authenticate';
        try { credentials.scopes = await authenticate(rpc, credentials, settings.scopes); authenticated = true; }
        finally { rpc.close(); }
      } catch (error) {
        if (!['LOGIN_REQUIRED', 'OAUTH_REJECTED', 'SCOPE_REQUIRED', 'RPC_ERROR'].includes(error.code)) throw error;
      }
      if (!authenticated) await login(settings, staging, this.connector, this.fetcher, next => { stage = next; });
      // Preserve a legacy secret when supplied or reused with existing credentials.
      if (!isActive() || this.bridge.closed) throw new BridgeError('BRIDGE_CLOSED', 'The bridge is shutting down.');
      stage = 'save_credentials';
      await store.save({ ...credentials, ...(settings.clientSecret ? { client_secret: settings.clientSecret } : {}) });
      saved.scopes = settings.scopes;
      stage = 'save_settings';
      await writeLocal(this.directory, join(this.directory, 'settings.json'), JSON.stringify(saved) + '\n');
      // No secret in the normal settings file or long-lived configuration object.
      settings.clientSecret = undefined;
      settings.env = { ...this.env };
      delete settings.env.DISCORD_CLIENT_SECRET;
      this.apply(settings);
      return { authenticated: true, scopes: credentials.scopes, storage: saved.storage };
    } catch (error) {
      if (error instanceof BridgeError) {
        error.setupStage = stage;
        error.requestedScopes = requestedScopes;
      }
      throw error;
    } finally { this.settingUp = false; }
  }
}

import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { page } from './page.js';
import { DEFAULT_SCOPES, SUPPORTED_SCOPES } from '../scopes.js';
import { BridgeError, publicError } from '../errors.js';

export function openBrowser(url) {
  const [command, args] = process.platform === 'win32' ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  return new Promise(resolve => {
    const child = spawn(command, args, { stdio: 'ignore', windowsHide: true });
    child.once('error', () => resolve(false));
    child.once('exit', code => resolve(code === 0));
    const timer = setTimeout(() => { child.unref(); resolve(false); }, 2000);
    child.once('close', () => clearTimeout(timer));
  });
}

export class Setup {
  constructor(runtime, { browser = openBrowser, lifetime = 15 * 60 * 1000 } = {}) {
    Object.assign(this, { runtime, browser, lifetime });
    this.state = 'idle';
  }
  async start() {
    if (this.closed) throw new BridgeError('BRIDGE_CLOSED', 'The bridge is shutting down.');
    if (this.starting) return this.starting;
    if (this.http && this.state === 'complete') this.expire();
    if (this.http) return this.info();
    this.starting = this.listen().finally(() => { this.starting = undefined; });
    return this.starting;
  }
  info() {
    return { state: this.state, setupUrl: this.url, browserOpened: this.browserOpened,
      developerPortalUrl: 'https://discord.com/developers/applications',
      redirectUri: this.runtime.settings.redirectUri,
      instructions: 'Ask the user to open setupUrl on the same computer as the MCP server. Each user must create or use their own Discord application. The page links to Developer Portal and explains application creation and OAuth2 settings. The user must enable Public Client, register the redirect URL, enter that application\'s Client ID in the page, then approve in Discord. No Client Secret is needed. Creating an application does not guarantee access to every requested RPC scope. Never ask for secrets in chat or read them using browser tools. Use setup_status after the user finishes, then get_guilds to verify connectivity. The URL expires after 15 minutes. Call setup again if it expires.' };
  }
  async listen() {
    const token = randomBytes(32).toString('hex');
    const path = `/setup/${token}`;
    const nonce = randomBytes(24).toString('base64');
    const server = createServer(async (request, response) => {
      const send = (status, value, type = 'application/json') => {
        response.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
          'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'` });
        response.end(type === 'text/html' ? value : JSON.stringify(value));
      };
      if (request.headers.host !== new URL(this.url).host || request.url !== path ||
          (request.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(request.headers['sec-fetch-site']))) {
        request.resume(); return send(403, { message: 'Invalid setup request.' });
      }
      if (request.method === 'GET') {
        const scopes = SUPPORTED_SCOPES.filter(scope => !DEFAULT_SCOPES.includes(scope) &&
          (scope !== 'voice' || this.runtime.settings.scopes.includes(scope)));
        return send(200, page({ nonce, token, defaults: {
          clientId: this.runtime.settings.clientId ?? '', redirectUri: this.runtime.settings.redirectUri,
          allowControl: this.runtime.settings.clientId ? this.runtime.settings.allowControl : true,
          scopes: [...DEFAULT_SCOPES, ...scopes],
        }, scopes }), 'text/html');
      }
      const supplied = Buffer.from(request.headers['x-setup-token'] ?? '');
      if (request.method !== 'POST' || request.headers.origin !== new URL(this.url).origin ||
          request.headers['content-type'] !== 'application/json' || supplied.length !== token.length ||
          !timingSafeEqual(supplied, Buffer.from(token))) {
        request.resume(); return send(403, { message: 'Invalid setup request.' });
      }
      if (this.state === 'connecting' || this.state === 'complete') {
        request.resume(); return send(409, { message: 'Setup is already in progress or complete.' });
      }
      let claimed = false;
      try {
        let body = '';
        let bytes = 0;
        for await (const chunk of request) {
          bytes += chunk.length;
          if (bytes > 8192) { send(413, { message: 'Setup input is too large.' }); request.destroy(); return; }
          body += chunk;
        }
        let input;
        try { input = JSON.parse(body); }
        catch { throw new BridgeError('INVALID_CONFIG', 'Invalid setup input.'); }
        body = '';
        if (!input || Object.keys(input).some(key => !['clientId', 'clientSecret', 'redirectUri', 'allowControl', 'storage', 'scopes'].includes(key))) {
          throw new BridgeError('INVALID_CONFIG', 'Invalid setup input.');
        }
        if (this.closed || !this.http) return send(410, { message: 'Setup expired. Ask your agent to call setup again.' });
        if (this.state === 'connecting' || this.state === 'complete') return send(409, { message: 'Setup is already in progress or complete.' });
        claimed = true;
        this.state = 'connecting'; this.error = undefined;
        try { await this.runtime.setup(input, { isActive: () => this.http === server && !this.closed }); }
        finally { input.clientSecret = ''; }
        this.state = 'complete';
        send(200, { authenticated: true });
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.expire(), 30000);
        this.timer.unref();
      } catch (error) {
        const safeError = publicError(error);
        if (this.http === server && (claimed || this.state !== 'connecting')) { this.state = 'failed'; this.error = safeError; }
        send(400, safeError);
      }
    });
    server.requestTimeout = 15000;
    server.headersTimeout = 10000;
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    if (this.closed) { server.close(); throw new BridgeError('BRIDGE_CLOSED', 'The bridge is shutting down.'); }
    this.http = server;
    this.url = `http://127.0.0.1:${server.address().port}${path}`;
    this.state = 'waiting'; this.error = undefined;
    this.timer = setTimeout(() => this.expire(), this.lifetime);
    this.timer.unref();
    this.browserOpened = await this.browser(this.url).catch(() => false);
    return this.info();
  }
  async status() { return { setupState: this.state, ...(this.error ? { error: this.error } : {}), ...await this.runtime.status() }; }
  expire() {
    clearTimeout(this.timer);
    this.http?.close();
    this.http?.closeAllConnections();
    this.http = undefined;
    this.url = undefined;
    if (this.state !== 'complete') this.state = 'expired';
  }
  close() { this.closed = true; this.expire(); }
}

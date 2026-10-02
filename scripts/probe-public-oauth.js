// Investigation only: never reads or writes the credential store.
import { randomBytes, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { connect } from '../src/ipc.js';
import { authenticate } from '../src/auth.js';
import { BridgeError, publicError } from '../src/errors.js';

export const probeScopes = ['rpc', 'messages.read', 'rpc.activities.write',
  'rpc.notifications.read', 'rpc.voice.read', 'rpc.voice.write'];

export async function probePublicOAuth(clientId, { connector = connect, fetcher = fetch,
  report = () => {}, wrongVerifier = false, scopes = probeScopes, authorizeOnly = false } = {}) {
  if (!/^\d{17,20}$/.test(clientId)) throw new BridgeError('INVALID_CONFIG', 'Provide a Discord application Client ID.');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  let rpc;
  let stage = 'connect';
  const grant = async parameters => {
    const response = await fetcher('https://discord.com/api/oauth2/token', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, ...parameters }),
    });
    let data;
    try { data = await response.json(); }
    catch { throw new BridgeError('OAUTH_INVALID_RESPONSE', 'Discord returned an invalid OAuth response.'); }
    if (!response.ok) {
      const reason = ['invalid_client', 'invalid_grant', 'invalid_request', 'unauthorized_client', 'invalid_scope'].includes(data?.error) ? data.error : 'rejected';
      throw new BridgeError('OAUTH_REJECTED', `OAuth HTTP ${response.status} (${reason})`);
    }
    if (typeof data?.access_token !== 'string' || !data.access_token) throw new BridgeError('OAUTH_INVALID_RESPONSE', 'No access token returned.');
    return data;
  };
  try {
    report({ stage });
    rpc = await connector(clientId);
    stage = 'authorize'; report({ stage, requestedScopes: scopes });
    const authorization = await rpc.request('AUTHORIZE', {
      client_id: clientId, scopes,
      ...(!authorizeOnly ? { code_challenge: challenge, code_challenge_method: 'S256' } : {}),
    }, 120000);
    if (typeof authorization?.code !== 'string' || !authorization.code) throw new BridgeError('AUTHORIZATION_FAILED', 'No authorization code returned.');
    if (authorizeOnly) {
      const summary = { success: true, authorizationCodeReceived: true, credentialsStored: false };
      report(summary);
      return summary;
    }
    stage = 'token_exchange'; report({ stage, secretUsed: false });
    const token = await grant({ grant_type: 'authorization_code', code: authorization.code,
      redirect_uri: 'http://127.0.0.1:8765/callback',
      code_verifier: wrongVerifier ? randomBytes(32).toString('base64url') : verifier });
    if (wrongVerifier) throw new BridgeError('PKCE_NOT_ENFORCED', 'Discord accepted the wrong PKCE verifier. Do not ship this flow.');
    stage = 'authenticate'; report({ stage });
    const grantedScopes = await authenticate(rpc, token, scopes);
    stage = 'read_guilds'; report({ stage });
    const result = await rpc.request('GET_GUILDS', {});
    if (!Array.isArray(result?.guilds)) throw new BridgeError('INVALID_RPC_RESPONSE', 'No guild list returned.');
    const guildCount = result.guilds.length;
    if (typeof token.refresh_token !== 'string' || !token.refresh_token) throw new BridgeError('OAUTH_INVALID_RESPONSE', 'No refresh token returned.');
    stage = 'refresh'; report({ stage, secretUsed: false });
    const renewed = await grant({ grant_type: 'refresh_token', refresh_token: token.refresh_token });
    rpc.close();
    rpc = undefined;
    stage = 'reconnect'; report({ stage });
    rpc = await connector(clientId);
    stage = 'authenticate_refreshed'; report({ stage });
    await authenticate(rpc, renewed, scopes);
    const summary = { success: true, scopes: grantedScopes, guildCount, refreshSucceeded: true, credentialsStored: false };
    report(summary);
    return summary;
  } catch (error) {
    const safe = error instanceof BridgeError ? publicError(error) : { code: 'PROBE_FAILED', message: 'Probe failed without exposing the remote response.' };
    const summary = { success: false, stage, ...safe, credentialsStored: false };
    report(summary);
    return summary;
  } finally { rpc?.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , clientId, option, ...extra] = process.argv;
  if (extra.length || (option && !['--wrong-verifier', '--base-scopes', '--authorize-only'].includes(option))) throw new Error('Usage: node scripts/probe-public-oauth.js CLIENT_ID [--wrong-verifier|--base-scopes|--authorize-only]');
  const result = await probePublicOAuth(clientId, {
    wrongVerifier: option === '--wrong-verifier', report: value => console.log(JSON.stringify(value)),
    authorizeOnly: option === '--authorize-only',
    ...(option === '--base-scopes' ? { scopes: ['rpc', 'messages.read'] } : {}),
  });
  process.exitCode = result.success ? 0 : 1;
}

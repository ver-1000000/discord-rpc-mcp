import { BridgeError } from './errors.js';
import { requestedScopes } from './scopes.js';

export function config(env = {}, { optional = false } = {}) {
  const clientId = env.DISCORD_CLIENT_ID;
  if (!(optional && clientId === undefined) && !/^\d{17,20}$/.test(clientId ?? '')) {
    throw new BridgeError('CONFIG_REQUIRED', 'Set DISCORD_CLIENT_ID to your Discord application ID.');
  }
  if (env.DISCORD_ALLOW_CONTROL && !['0', '1'].includes(env.DISCORD_ALLOW_CONTROL)) {
    throw new BridgeError('INVALID_CONFIG', 'DISCORD_ALLOW_CONTROL must be 0 or 1.');
  }
  if (env.DISCORD_CREDENTIAL_STORAGE && env.DISCORD_CREDENTIAL_STORAGE !== 'keyring') {
    throw new BridgeError('INVALID_CONFIG', 'Credentials must be stored in the OS keyring.');
  }
  return {
    storage: 'keyring',
    clientId,
    redirectUri: env.DISCORD_REDIRECT_URI ?? 'http://127.0.0.1:8765/callback',
    allowControl: env.DISCORD_ALLOW_CONTROL === '1',
    scopes: requestedScopes(env.DISCORD_SCOPES),
    env,
  };
}

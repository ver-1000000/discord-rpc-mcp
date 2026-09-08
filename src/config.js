import { BridgeError } from './errors.js';
import { requestedScopes } from './scopes.js';

export function config(env = process.env) {
  const clientId = env.DISCORD_CLIENT_ID;
  if (!/^\d{17,20}$/.test(clientId ?? '')) {
    throw new BridgeError('CONFIG_REQUIRED', 'Set DISCORD_CLIENT_ID to your Discord application ID.');
  }
  if (env.DISCORD_ALLOW_CONTROL && !['0', '1'].includes(env.DISCORD_ALLOW_CONTROL)) {
    throw new BridgeError('INVALID_CONFIG', 'DISCORD_ALLOW_CONTROL must be 0 or 1.');
  }
  return {
    clientId,
    clientSecret: env.DISCORD_CLIENT_SECRET,
    redirectUri: env.DISCORD_REDIRECT_URI ?? 'http://127.0.0.1:8765/callback',
    allowControl: env.DISCORD_ALLOW_CONTROL === '1',
    scopes: requestedScopes(env.DISCORD_SCOPES),
    env,
  };
}

import { BridgeError } from './errors.js';

export const DEFAULT_SCOPES = ['rpc', 'messages.read'];
export const SUPPORTED_SCOPES = [
  ...DEFAULT_SCOPES, 'rpc.activities.write', 'rpc.notifications.read',
  'rpc.voice.read', 'rpc.voice.write', 'voice',
];

export function requestedScopes(value = '') {
  const extra = value.split(/[\s,]+/).filter(Boolean);
  if (extra.some(scope => !SUPPORTED_SCOPES.includes(scope))) {
    throw new BridgeError('INVALID_SCOPES', 'DISCORD_SCOPES must contain supported RPC scopes only.');
  }
  return [...new Set([...DEFAULT_SCOPES, ...extra])];
}

export function requireScopes(granted, required = DEFAULT_SCOPES) {
  const missing = required.filter(scope => !granted.includes(scope));
  if (missing.length) {
    throw new BridgeError('SCOPE_REQUIRED', `Run login again with DISCORD_SCOPES including: ${missing.join(' ')}`);
  }
}

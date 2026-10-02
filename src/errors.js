export class BridgeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
  }
}

const setupStages = ['validation', 'load_credentials', 'connect', 'authorize', 'token_exchange', 'authenticate', 'save_credentials', 'save_settings'];
const scopePattern = /^(rpc(?:\.(activities\.write|notifications\.read|(?:voice|video|screenshare)\.(read|write)))?|messages\.read|voice)$/;

export function publicError(error) {
  if (!(error instanceof BridgeError)) return { code: 'INTERNAL_ERROR', message: 'The operation failed. Check your local configuration.' };
  const result = { code: error.code, message: error.message };
  if (setupStages.includes(error.setupStage)) {
    result.stage = error.setupStage;
    if (Array.isArray(error.requestedScopes) && error.requestedScopes.length <= 11 &&
        error.requestedScopes.every(scope => typeof scope === 'string' && scopePattern.test(scope))) {
      result.requestedScopes = [...error.requestedScopes];
    }
  }
  return result;
}

#!/usr/bin/env node
import { loadEnvFile } from 'node:process';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config } from './config.js';
import { CredentialStore } from './credentials.js';
import { Auth, login } from './auth.js';
import { connect } from './ipc.js';
import { Bridge } from './bridge.js';
import { createServer } from './server.js';
import { BridgeError, publicError } from './errors.js';

let bridge;
let server;
try {
  const args = process.argv.slice(2);
  if (args[0] === '--help' || args[0] === '-h') {
    console.log('discord-rpc-mcp [--env-file PATH] [serve|login|status|logout]\n\nDefault: serve (stdio). Requires Discord desktop and an available OS credential store.\nSupports Windows, macOS and Linux (Secret Service).\nSet DISCORD_CLIENT_ID. Login and renewal also require DISCORD_CLIENT_SECRET.\nSet DISCORD_ALLOW_CONTROL=1 to expose navigation, voice, activity and invite tools.');
  } else {
    if (args[0] === '--env-file') {
      const file = args[1];
      if (!file) throw new BridgeError('INVALID_ARGUMENT', 'Provide a path after --env-file.');
      try { loadEnvFile(file); }
      catch { throw new BridgeError('CONFIG_UNAVAILABLE', 'Could not load the environment file.'); }
      args.splice(0, 2);
    }
    const mode = args.shift() ?? 'serve';
    if (args.length || !['serve', 'login', 'status', 'logout'].includes(mode)) {
      throw new BridgeError('INVALID_ARGUMENT', 'Use --help for supported commands.');
    }
    const settings = config();
    const store = new CredentialStore(settings.clientId);
    if (mode === 'login') {
      console.error('Approve the authorization request in Discord.');
      console.log(JSON.stringify(await login(settings, store, connect)));
    } else if (mode === 'logout') {
      await store.clear();
      console.log('Local credentials removed. Stop running bridge processes; revoke app access in Discord to invalidate authorization.');
    } else if (mode === 'status') {
      const value = await store.load();
      console.log(JSON.stringify({
        credentialsStored: true,
        expired: value.expires_at <= Date.now(),
        expiresAt: new Date(value.expires_at).toISOString(),
        canRefresh: !!value.refresh_token && !!settings.clientSecret,
        scopes: value.scopes ?? null,
        missingScopes: value.scopes ? settings.scopes.filter(scope => !value.scopes.includes(scope)) : null,
      }));
    } else {
      bridge = new Bridge(settings, new Auth(settings, store));
      server = createServer(bridge, settings);
      const shutdown = () => { bridge.close(); void server.close(); };
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
      process.stdin.once('end', shutdown);
      await server.connect(new StdioServerTransport());
    }
  }
} catch (error) {
  bridge?.close();
  await server?.close();
  console.error(JSON.stringify(publicError(error)));
  process.exitCode = 1;
}

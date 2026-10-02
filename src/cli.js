#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Runtime } from './runtime.js';
import { Setup } from './setup/index.js';
import { createServer } from './server.js';
import { BridgeError, publicError } from './errors.js';

let bridge;
let server;
let setup;
try {
  const args = process.argv.slice(2);
  if (args[0] === '--help' || args[0] === '-h') {
    console.log('discord-rpc-mcp [serve|login|status|logout]\n\nDefault: serve (stdio). Requires Discord desktop and an OS credential store.\nSupports Windows, macOS and Linux (Secret Service).\nNo initial configuration required. Ask your agent to call setup and enter your own application\'s Client ID in the local browser page.\nEnable controls and permissions in the setup page.');
  } else {
    const mode = args.shift() ?? 'serve';
    if (args.length || !['serve', 'login', 'status', 'logout'].includes(mode)) {
      throw new BridgeError('INVALID_ARGUMENT', 'Use --help for supported commands.');
    }
    const runtime = new Runtime();
    await runtime.initialize();
    const settings = runtime.settings;
    if (mode === 'login') {
      console.error('Approve the authorization request in Discord.');
      console.log(JSON.stringify(await runtime.login()));
    } else if (mode === 'logout') {
      await runtime.store().clear();
      console.log('Local credentials removed. Stop running bridge processes; revoke app access in Discord to invalidate authorization.');
    } else if (mode === 'status') {
      console.log(JSON.stringify(await runtime.status()));
    } else {
      bridge = runtime.bridge;
      setup = new Setup(runtime);
      server = createServer(bridge, settings, setup);
      const shutdown = () => { setup.close(); bridge.close(); void server.close(); };
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
      process.stdin.once('end', shutdown);
      await server.connect(new StdioServerTransport());
    }
  }
} catch (error) {
  setup?.close();
  bridge?.close();
  await server?.close();
  console.error(JSON.stringify(publicError(error)));
  process.exitCode = 1;
}

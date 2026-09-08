import assert from 'node:assert/strict';
import { mkdtemp, copyFile, chmod, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CredentialStore } from '../src/credentials.js';
import { randomBytes } from 'node:crypto';

const directory = await mkdtemp(join(tmpdir(), 'discord-rpc-mcp-binary-'));
const binary = `discord-rpc-mcp${process.platform === 'win32' ? '.exe' : ''}`;
const executable = join(directory, binary);
const env = {
  ...Object.fromEntries(['HOME', 'USER', 'LOGNAME', 'TMPDIR', 'SystemRoot', 'APPDATA', 'LOCALAPPDATA']
    .filter(name => process.env[name]).map(name => [name, process.env[name]])),
  PATH: directory,
  DISCORD_CLIENT_ID: '123456789012345678',
};
const client = new Client({ name: 'binary-smoke', version: '1.0.0' });
try {
  await copyFile(resolve('dist', binary), executable);
  await chmod(executable, 0o755);
  // The executable must neither need external commands nor autoload the working directory's .env.
  await writeFile(join(directory, '.env'), 'DISCORD_ALLOW_CONTROL=1\n');
  await writeFile(join(directory, 'settings.env'), 'DISCORD_CLIENT_ID=123456789012345678\n');
  assert.match(execFileSync(executable, ['--help'], { cwd: directory, env, timeout: 10000 }).toString(), /credential store/);
  const transport = new StdioClientTransport({
    command: executable,
    args: ['--env-file', join(directory, 'settings.env')],
    cwd: directory,
    env,
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr.on('data', chunk => { stderr += chunk; });
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length, 9);
  assert.equal(client.getServerCapabilities().resources.subscribe, true);
  assert.equal((await client.listResources()).resources[0].uri, 'discord://events');
  await client.subscribeResource({ uri: 'discord://events' });
  const snapshot = await client.readResource({ uri: 'discord://events' });
  assert.deepEqual(JSON.parse(snapshot.contents[0].text).events, []);
  await client.unsubscribeResource({ uri: 'discord://events' });
  const result = await client.callTool({ name: 'get_events', arguments: {} });
  assert.equal(result.isError, undefined);
  assert.equal(result.structuredContent.connected, false);
  assert.deepEqual(result.structuredContent.events, []);
  await client.close();
  assert.equal(stderr, '');
  if (process.platform === 'win32' || process.platform === 'darwin') {
    // Use an isolated application ID, never a developer's real Discord credentials.
    const id = (100000000000000000n + BigInt('0x' + randomBytes(7).toString('hex'))).toString();
    const store = new CredentialStore(id);
    try {
      await assert.rejects(store.load(), { code: 'LOGIN_REQUIRED' });
      const credentials = { access_token: 'SMOKE_TEST_ONLY', expires_at: Date.now() + 3600000 };
      await store.save(credentials);
      assert.deepEqual(await store.load(), credentials);
      console.log('Native credential store: source round-trip passed.');
      if (process.platform === 'darwin') {
        await store.clear();
        // This random, fake credential is shared across unsigned test executables.
        // Allow noninteractive access only to this disposable item, never real tokens.
        execFileSync('/usr/bin/security', ['add-generic-password',
          '-a', `oauth:${id}`, '-s', 'discord-rpc-mcp', '-w', JSON.stringify(credentials),
          '-A'], { timeout: 10000 });
      }
      console.log('Native credential store: standalone read starting.');
      const output = execFileSync(executable, ['status'], { cwd: directory, env: { ...env, DISCORD_CLIENT_ID: id }, timeout: 30000 }).toString();
      assert.equal(JSON.parse(output).credentialsStored, true);
      assert.ok(!output.includes('SMOKE_TEST_ONLY'));
      console.log('Native credential store: standalone delete starting.');
      execFileSync(executable, ['logout'], { cwd: directory, env: { ...env, DISCORD_CLIENT_ID: id }, timeout: 30000 });
      await assert.rejects(store.load(), { code: 'LOGIN_REQUIRED' });
    } finally { await store.clear(); }
    console.log('Native credential store: source write, standalone read and standalone delete passed.');
  }
  console.log('Standalone binary: help, explicit env file and MCP stdio passed with an isolated working directory and PATH.');
} finally {
  await client.close();
  await rm(directory, { recursive: true, force: true });
}

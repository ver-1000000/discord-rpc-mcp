import assert from 'node:assert/strict';
import { mkdtemp, copyFile, chmod, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const directory = await mkdtemp(join(tmpdir(), 'discord-rpc-mcp-binary-'));
const executable = join(directory, 'discord-rpc-mcp');
const env = { PATH: directory, DISCORD_CLIENT_ID: '123456789012345678' };
const client = new Client({ name: 'binary-smoke', version: '1.0.0' });
try {
  await copyFile(resolve('dist/discord-rpc-mcp'), executable);
  await chmod(executable, 0o755);
  // The executable must neither need external commands nor autoload the working directory's .env.
  await writeFile(join(directory, '.env'), 'DISCORD_ALLOW_CONTROL=1\n');
  await writeFile(join(directory, 'settings.env'), 'DISCORD_CLIENT_ID=123456789012345678\n');
  assert.match(execFileSync(executable, ['--help'], { cwd: directory, env, timeout: 10000 }).toString(), /Secret Service/);
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
  const result = await client.callTool({ name: 'get_events', arguments: {} });
  assert.equal(result.isError, undefined);
  assert.equal(result.structuredContent.connected, false);
  assert.deepEqual(result.structuredContent.events, []);
  await client.close();
  assert.equal(stderr, '');
  console.log('Standalone binary: help, explicit env file and MCP stdio passed with an isolated working directory and PATH.');
} finally {
  await client.close();
  await rm(directory, { recursive: true, force: true });
}

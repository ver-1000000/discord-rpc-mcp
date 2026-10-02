import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('新しいstdioプロセスはDiscordや認可操作なしで起動し、MCPとして応答する', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'discord-stdio-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const client = new Client({ name: 'stdio-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../src/cli.js', import.meta.url))],
    env: { DISCORD_CONFIG_DIR: directory },
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr.on('data', chunk => { stderr += chunk; });
  t.after(() => client.close());
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length, 11);
  const result = await client.callTool({ name: 'get_events', arguments: {} });
  assert.equal(result.isError, undefined);
  assert.equal(result.structuredContent.connected, false);
  assert.equal(result.structuredContent.historyComplete, false);
  assert.deepEqual(result.structuredContent.events, []);
  await client.close();
  assert.equal(stderr, '');
});


test('CLIはenvファイルを読み込まず、秘密を出力せずに拒否する', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'discord-env-rejected-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, ['--', fileURLToPath(new URL('../src/cli.js', import.meta.url)), '--env-file', join(directory, '.env'), 'status'], {
    encoding: 'utf8', env: { DISCORD_CONFIG_DIR: directory },
  });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stderr).code, 'INVALID_ARGUMENT');
  assert.equal(result.stdout, '');
});

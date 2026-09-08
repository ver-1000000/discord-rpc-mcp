import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('新しいstdioプロセスはDiscordや認可操作なしで起動し、MCPとして応答する', async t => {
  const client = new Client({ name: 'stdio-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../src/cli.js', import.meta.url))],
    env: { DISCORD_CLIENT_ID: '123456789012345678' },
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr.on('data', chunk => { stderr += chunk; });
  t.after(() => client.close());
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length, 9);
  const result = await client.callTool({ name: 'get_events', arguments: {} });
  assert.equal(result.isError, undefined);
  assert.equal(result.structuredContent.connected, false);
  assert.equal(result.structuredContent.historyComplete, false);
  assert.deepEqual(result.structuredContent.events, []);
  await client.close();
  assert.equal(stderr, '');
});

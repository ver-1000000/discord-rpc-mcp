import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = await mkdtemp(join(tmpdir(), 'discord-rpc-mcp-install-'));
const destination = join(root, 'path with spaces');
const windows = process.platform === 'win32';
const run = () => windows
  ? execFileSync('pwsh', ['-NoProfile', '-File', resolve('install.ps1'), '-InstallDir', destination], { timeout: 120000 })
  : execFileSync('/bin/sh', [resolve('install.sh')], {
    env: { ...process.env, DISCORD_RPC_MCP_INSTALL_DIR: destination }, timeout: 120000,
  });
try {
  run();
  const binary = join(destination, 'bin', `discord-rpc-mcp${windows ? '.exe' : ''}`);
  const envFile = join(destination, 'config', '.env');
  assert.match(execFileSync(binary, ['--help']).toString(), /credential store/);
  assert.match(await readFile(envFile, 'utf8'), /DISCORD_CLIENT_ID=/);
  if (!windows) assert.equal((await stat(envFile)).mode & 0o777, 0o600);
  const settings = 'DISCORD_CLIENT_ID=123456789012345678\n# Keep my configuration\n';
  await writeFile(envFile, settings);
  run();
  assert.equal(await readFile(envFile, 'utf8'), settings);
  console.log('Installer: verified release installed, binary starts, existing configuration preserved.');
} finally {
  await rm(root, { recursive: true, force: true });
}

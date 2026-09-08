import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

test('Unix installer rejects a corrupted download without touching an existing installation', { skip: process.platform === 'win32' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'installer-check-'));
  try {
    const bin = join(root, 'commands');
    const target = join(root, 'installed');
    await mkdir(bin);
    await mkdir(join(target, 'bin'), { recursive: true });
    await writeFile(join(target, 'bin', 'discord-rpc-mcp'), 'existing binary');
    await writeFile(join(bin, 'curl'), '#!/bin/sh\nwhile [ "$#" -gt 0 ]; do\nif [ "$1" = -o ]; then shift; printf corrupted > "$1"; exit 0; fi\nshift\ndone\nexit 1\n', { mode: 0o755 });
    assert.throws(() => execFileSync('/bin/sh', [resolve('install.sh')], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, DISCORD_RPC_MCP_INSTALL_DIR: target }, stdio: 'pipe',
    }), error => error.status !== 0 && /Checksum mismatch/.test(error.stderr.toString()));
    assert.equal(await readFile(join(target, 'bin', 'discord-rpc-mcp'), 'utf8'), 'existing binary');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Windows installer rejects a corrupted download', { skip: process.platform !== 'win32' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'installer-check-'));
  try {
    const script = join(root, 'check.ps1');
    await writeFile(script, `param([string]$Installer, [string]$Destination)
function Invoke-WebRequest { param($Uri, $OutFile, [switch]$UseBasicParsing) [IO.File]::WriteAllText($OutFile, 'corrupted') }
& $Installer -InstallDir $Destination
`);
    assert.throws(() => execFileSync('pwsh', ['-NoProfile', '-File', script, resolve('install.ps1'), join(root, 'installed')], { stdio: 'pipe' }), error => error.status !== 0 && /Checksum mismatch/.test(error.stderr.toString()));
  } finally { await rm(root, { recursive: true, force: true }); }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { VERSIONED_MANIFEST_SCHEMAS } from '@anthropic-ai/mcpb/schemas';

test('MCPB manifest provides native launchers and only asks for an external configuration path', async () => {
  const manifest = JSON.parse(await readFile('mcpb/manifest.json', 'utf8'));
  VERSIONED_MANIFEST_SCHEMAS['0.3'].parse(manifest);
  assert.equal(manifest.version, JSON.parse(await readFile('package.json', 'utf8')).version);
  assert.equal(manifest.server.type, 'binary');
  assert.deepEqual(manifest.server.mcp_config.args, ['--env-file', '${user_config.env_file}']);
  assert.equal(manifest.server.mcp_config.platform_overrides.win32.command, '${__dirname}/server/windows-x64/discord-rpc-mcp.exe');
  assert.deepEqual(Object.keys(manifest.user_config), ['env_file']);
});

test('Unix launcher chooses the matching binary and preserves arguments with spaces', { skip: process.platform === 'win32' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mcpb launch '));
  try {
    await copyFile('mcpb/launch.sh', join(directory, 'launch.sh'));
    await mkdir(join(directory, 'commands'));
    await writeFile(join(directory, 'commands/uname'), '#!/bin/sh\ncase "$1" in -s) echo "$TEST_OS";; -m) echo "$TEST_ARCH";; esac\n', { mode: 0o755 });
    for (const [os, arch, platform] of [['Linux', 'x86_64', 'linux-x64'], ['Darwin', 'x86_64', 'macos-x64'], ['Darwin', 'arm64', 'macos-arm64']]) {
      await mkdir(join(directory, platform));
      await writeFile(join(directory, platform, 'discord-rpc-mcp'), `#!/bin/sh\nprintf '%s\\n' '${platform}' "$@"\n`, { mode: 0o755 });
      const env = { ...process.env, PATH: `${directory}/commands:${process.env.PATH}`, TEST_OS: os, TEST_ARCH: arch };
      assert.equal(execFileSync('/bin/sh', [join(directory, 'launch.sh'), '--env-file', '/path with spaces/.env'], { env, encoding: 'utf8' }), `${platform}\n--env-file\n/path with spaces/.env\n`);
    }
    assert.throws(() => execFileSync('/bin/sh', [join(directory, 'launch.sh')], { env: { ...process.env, PATH: `${directory}/commands:${process.env.PATH}`, TEST_OS: 'Linux', TEST_ARCH: 'aarch64' }, stdio: 'pipe' }), { status: 1 });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

import { mkdir, mkdtemp, readFile, writeFile, copyFile, chmod } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { packExtension } from '@anthropic-ai/mcpb';

if (process.platform === 'win32') throw new Error('Package on Linux or macOS to preserve executable permissions.');
const input = resolve(process.argv[2] ?? 'artifacts');
const output = resolve('dist');
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir(output, { recursive: true });
const stage = await mkdtemp(join(output, 'mcpb-'));
for (const folder of ['server', 'assets', 'docs', 'licenses']) await mkdir(join(stage, folder));
for (const platform of ['linux-x64', 'windows-x64', 'macos-arm64', 'macos-x64']) {
  const source = join(input, `discord-rpc-mcp-${platform}`);
  const name = platform === 'windows-x64' ? 'discord-rpc-mcp.exe' : 'discord-rpc-mcp';
  const bytes = await readFile(join(source, name));
  const digest = createHash('sha256').update(bytes).digest('hex');
  if ((await readFile(join(source, 'SHA256SUMS'), 'utf8')).trim() !== `${digest}  ${name}`) {
    throw new Error(`Binary checksum mismatch: ${platform}`);
  }
  await mkdir(join(stage, 'server', platform));
  const target = join(stage, 'server', platform, name);
  await copyFile(join(source, name), target);
  await chmod(target, 0o755);
  await copyFile(join(source, 'THIRD_PARTY_NOTICES.md'), join(stage, 'licenses', `${platform}.md`));
}
for (const name of ['README.md', 'README.ja.md', 'LICENSE', '.env.example', 'assets/icon.png', 'assets/icon.svg', 'docs/configuration.md', 'docs/development.md']) {
  await copyFile(name, join(stage, name));
}
await copyFile('mcpb/launch.sh', join(stage, 'server/launch.sh'));
await chmod(join(stage, 'server/launch.sh'), 0o755);
const manifest = JSON.parse(await readFile('mcpb/manifest.json', 'utf8'));
if (manifest.version !== pkg.version) throw new Error('Manifest version must match package.json');
await writeFile(join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const bundle = join(output, `discord-rpc-mcp-v${pkg.version}.mcpb`);
if (!await packExtension({ extensionPath: stage, outputPath: bundle, silent: true })) throw new Error('MCPB packaging failed');
const digest = createHash('sha256').update(await readFile(bundle)).digest('hex');
console.log(JSON.stringify({ bundle, stage, sha256: digest }));

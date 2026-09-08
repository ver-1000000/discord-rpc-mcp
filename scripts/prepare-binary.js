import { copyFile, readFile, readdir, writeFile, stat, cp, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

for (const name of ['LICENSE', 'README.md', 'README.ja.md', '.env.example']) {
  await copyFile(name, join('dist', name));
}
await cp('docs', 'dist/docs', { recursive: true });
await mkdir('dist/assets', { recursive: true });
await copyFile('assets/icon.svg', 'dist/assets/icon.svg');
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const notices = ['# Third-party software', 'This executable includes the following npm dependencies.'];
for (const [directory, pkg] of Object.entries(lock.packages)) {
  if (!directory || pkg.dev) continue;
  notices.push(`## ${directory.replace(/^node_modules\//, '')} ${pkg.version}`, `License: ${pkg.license ?? 'See package source'}`);
  for (const name of (await readdir(directory)).sort()) {
    const path = join(directory, name);
    if (/^(licen[sc]e|copying|notice)(\.|$)/i.test(name) && (await stat(path)).isFile()) {
      notices.push(await readFile(path, 'utf8'));
    }
  }
}
const bunVersion = lock.packages['node_modules/bun'].version;
notices.push(`## Bun ${bunVersion}`, `Runtime source, licenses and relinking instructions: https://github.com/oven-sh/bun/tree/bun-v${bunVersion}`,
  `https://github.com/oven-sh/bun/blob/bun-v${bunVersion}/LICENSE.md`);
await writeFile('dist/THIRD_PARTY_NOTICES.md', notices.join('\n\n') + '\n');
const hash = createHash('sha256').update(await readFile('dist/discord-rpc-mcp')).digest('hex');
await writeFile('dist/SHA256SUMS', `${hash}  discord-rpc-mcp\n`);

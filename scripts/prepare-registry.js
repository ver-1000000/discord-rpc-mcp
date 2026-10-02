import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Keep the checked-in manifest describing the published release until the new bundle exists.
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const manifest = JSON.parse(await readFile('server.json', 'utf8'));
const bundle = process.argv[2] ?? `dist/discord-rpc-mcp-v${pkg.version}.mcpb`;
const bytes = await readFile(bundle);
manifest.version = pkg.version;
manifest.icons[0].src = `https://raw.githubusercontent.com/ver-1000000/discord-rpc-mcp/v${pkg.version}/assets/icon.png`;
manifest.packages[0].identifier = `https://github.com/ver-1000000/discord-rpc-mcp/releases/download/v${pkg.version}/discord-rpc-mcp-v${pkg.version}.mcpb`;
manifest.packages[0].fileSha256 = createHash('sha256').update(bytes).digest('hex');
await writeFile('dist/server.json', JSON.stringify(manifest, null, 2) + '\n');
console.log('Prepared dist/server.json. Copy it to server.json when publishing this release.');

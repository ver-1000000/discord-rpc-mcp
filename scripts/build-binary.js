import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const platform = process.platform;
if (!['linux', 'darwin', 'win32'].includes(platform)) throw new Error('Unsupported build platform');
const outfile = process.argv[3] ?? `dist/discord-rpc-mcp${platform === 'win32' ? '.exe' : ''}`;
const result = await Bun.build({
  entrypoints: [process.argv[2] ?? './src/cli.js'],
  minify: true,
  compile: { outfile, autoloadDotenv: false, autoloadBunfig: false },
  plugins: [{
    name: 'platform-keyring',
    setup(build) {
      build.onResolve({ filter: /^@napi-rs\/keyring$/ }, () => {
        if (platform === 'linux') return { path: 'unused-native-keyring', namespace: 'keyring-stub' };
        const suffix = platform === 'win32' ? '-msvc' : '';
        return { path: resolve(require.resolve(`@napi-rs/keyring-${platform}-${process.arch}${suffix}`)) };
      });
      build.onLoad({ filter: /.*/, namespace: 'keyring-stub' }, () => ({
        contents: 'export class AsyncEntry { constructor() { throw new Error("Use Secret Service on Linux"); } }', loader: 'js',
      }));
    },
  }],
});
if (!result.success) throw new AggregateError(result.logs, 'Binary build failed');
if (platform === 'darwin') {
  execFileSync('/usr/bin/codesign', ['--force', '--sign', '-',
    '--identifier', 'com.ver1000000.discord-rpc-mcp',
    '--entitlements', 'scripts/macos-entitlements.plist', outfile], { stdio: 'inherit' });
  execFileSync('/usr/bin/codesign', ['--verify', '--strict', outfile], { stdio: 'inherit' });
}
console.log(`Built ${outfile} (${platform}/${process.arch})`);

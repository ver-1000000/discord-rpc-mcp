# Development

Requires Node.js 22+. Bun is installed as a development dependency; standalone executable users need neither runtime.

```sh
npm ci
npm test
npm run build:binary
npm run test:binary
```

If npm lifecycle scripts are disabled, run `npm rebuild bun --ignore-scripts=false` before building.

The executable is written to `dist/discord-rpc-mcp` for the build host's architecture. CI builds Linux x64 (glibc), tests the standalone executable and uploads an Actions artifact. No prebuilt GitHub Release is published yet. Use `node src/cli.js` to run from source.

## Live verification

Voice mutations, certified devices, Rich Presence and activity invitations have not yet been verified against a live Discord client. Automated coverage does not imply Discord grants every scope to every application.

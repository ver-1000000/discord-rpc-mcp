# Development

Requires Node.js 22+. Bun is installed as a development dependency; standalone executable users need neither runtime.

```sh
npm ci
npm test
npm run build:binary
npm run test:binary
```

If npm lifecycle scripts are disabled, run `npm rebuild bun --ignore-scripts=false` before building.

The executable is written to `dist/discord-rpc-mcp` (`.exe` on Windows) for the build host's architecture. CI builds Linux x64 (glibc), Windows x64 and macOS arm64/x64, tests the standalone executables and uploads Actions artifacts. Windows and macOS builds embed the native credential store module. Prebuilt executables are available from [Latest Release](https://github.com/ver-1000000/discord-rpc-mcp/releases/latest). Use `node src/cli.js` to run from source.

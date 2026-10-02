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

## Testing

Tests use isolated settings directories and dummy credentials. `DISCORD_CONFIG_DIR` selects an isolated profile. Do not automate a real user's secret input.

The binary smoke test checks startup, MCP stdio, and the embedded setup page. On Windows and macOS it also checks the native credential store with disposable test entries.

## Packaging a release

1. Build and test each supported platform in CI, then download the four `discord-rpc-mcp-PLATFORM` artifacts into `artifacts/`.
2. Run `npm run pack:mcpb` to generate the bundle and `dist/server.json` with its SHA-256.
3. Replace the checked-in `server.json` with the generated manifest when publishing the release.
4. Publish the platform archives and MCPB together, then run the **Publish MCP Registry** workflow.

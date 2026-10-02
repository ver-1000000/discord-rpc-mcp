# Installation

Supports Windows, macOS and Linux.
Run Discord desktop on the same computer as the MCP server.

To store authorization tokens securely, an OS credential store is required (Secret Service on Linux).

## 1. Register and enable the MCP

### Codex and Claude Code

Install Node.js 22+, npm and Git, then run the command for your client.

```sh
# Codex
codex mcp add discord-rpc-mcp -- npx -y github:ver-1000000/discord-rpc-mcp

# Claude Code
claude mcp add --scope user discord-rpc-mcp -- npx -y github:ver-1000000/discord-rpc-mcp
```

Reload and enable the MCP in your client.
`npx` handles fetching and storing the files.

### MCPB-compatible clients

Install and enable the `.mcpb` from [Releases](https://github.com/ver-1000000/discord-rpc-mcp/releases) through your client's extension interface.
No Node.js installation is required.

## 2. Ask your agent to set up Discord

Tell your agent: **Set up discord-rpc-mcp.**
A local setup page guides you through creating or using a Discord application you own, enabling **Public Client**, entering its Client ID and connecting.
Check the application name and requested permissions in Discord's authorization prompt, then approve.

Initial setup selects controls and all displayed additional permissions.
Uncheck any permissions you do not need under **Advanced options**.

If the browser does not open, open the URL provided by your agent on the same computer.

Tell the agent when setup is complete and verify it can retrieve your server list.
No MCP restart is needed.

## Manually register a standalone binary

To register without Node.js, download and extract the archive for your OS and CPU from [Releases](https://github.com/ver-1000000/discord-rpc-mcp/releases).
Distribution targets are Linux x64 (glibc), Windows x64 and macOS arm64 / x64.

Save the executable and specify its absolute path in your client's MCP configuration.
On macOS and Linux it needs executable permissions.
For clients configured using JSON:

```json
{
  "mcpServers": {
    "discord-rpc-mcp": {
      "command": "/absolute/path/discord-rpc-mcp"
    }
  }
}
```

On Windows use a path such as `C:/path/to/discord-rpc-mcp.exe`.
After registration, continue to “Ask your agent to set up Discord” above.

See the [usage guide](usage.md) for permissions, credential storage, event subscriptions and troubleshooting.

[Back to README](../README.md)

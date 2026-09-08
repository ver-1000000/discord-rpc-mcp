# Installation

Supports Windows, macOS and Linux. Requires the Discord desktop app and an available OS credential store (a Secret Service keyring on Linux).

## 1. Install

macOS and Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/ver-1000000/discord-rpc-mcp/main/install.sh | sh
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/ver-1000000/discord-rpc-mcp/main/install.ps1 | iex
```

## 2. Connect Discord

Follow the [Discord setup steps in the README](../README.md#2-connect-discord) and enter the application ID and client secret in the `.env` file at the path printed by the installer. When an agent handles setup, wait for the user to finish entering these values before running the commands below.

Start Discord, then run:

macOS and Linux:

```sh
"$HOME/.local/share/discord-rpc-mcp/bin/discord-rpc-mcp" --env-file "$HOME/.local/share/discord-rpc-mcp/config/.env" login
```

Windows (PowerShell):

```powershell
& "$env:LOCALAPPDATA\discord-rpc-mcp\bin\discord-rpc-mcp.exe" --env-file "$env:LOCALAPPDATA\discord-rpc-mcp\config\.env" login
```

Approve the request in Discord. Your credentials are saved and reused on subsequent connections.

## 3. Add to your MCP client

Follow only the instructions for the client you use.

### Codex

macOS and Linux:

```sh
codex mcp add discord-rpc-mcp -- "$HOME/.local/share/discord-rpc-mcp/bin/discord-rpc-mcp" --env-file "$HOME/.local/share/discord-rpc-mcp/config/.env"
```

Windows (PowerShell):

```powershell
codex mcp add discord-rpc-mcp -- "$env:LOCALAPPDATA\discord-rpc-mcp\bin\discord-rpc-mcp.exe" --env-file "$env:LOCALAPPDATA\discord-rpc-mcp\config\.env"
```

### Claude Code

macOS and Linux:

```sh
claude mcp add --transport stdio --scope user discord-rpc-mcp -- "$HOME/.local/share/discord-rpc-mcp/bin/discord-rpc-mcp" --env-file "$HOME/.local/share/discord-rpc-mcp/config/.env"
```

Windows (PowerShell):

```powershell
claude mcp add --transport stdio --scope user discord-rpc-mcp -- "$env:LOCALAPPDATA\discord-rpc-mcp\bin\discord-rpc-mcp.exe" --env-file "$env:LOCALAPPDATA\discord-rpc-mcp\config\.env"
```

### Other MCP clients

Add this configuration to your MCP client, using the absolute paths from the installer:

```json
{
  "mcpServers": {
    "discord-rpc-mcp": {
      "command": "/absolute/path/bin/discord-rpc-mcp",
      "args": ["--env-file", "/absolute/path/config/.env"]
    }
  }
}
```

On Windows, use a command path such as `C:/path/to/discord-rpc-mcp.exe`. Keep Discord running while using the server.

### Claude Desktop and MCPB

After completing Discord authorization in steps 1 and 2, install the `.mcpb` from [Latest Release](https://github.com/ver-1000000/discord-rpc-mcp/releases/latest) in your client and select the same `.env` file. Use the JSON configuration above for clients without MCPB support.

## Verify the connection

Reload the client's MCP configuration and confirm that `get_guilds` returns the server list. The `status` command only checks stored credentials, not Discord connectivity. Restart the MCP server or client only if needed.

Reuse existing configuration and credentials when available, and preserve other MCP entries. Enter secrets in the local `.env` file, not in chat. Start with read-only access; see [Configuration](configuration.md) if controls are wanted.

[Claude Code MCP configuration](https://code.claude.com/docs/en/mcp) · [Back to README](../README.md)

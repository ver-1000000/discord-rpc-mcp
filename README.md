<p align="center">
  <img src="assets/icon.svg" width="128" alt="Discord RPC MCP">
</p>

# discord-rpc-mcp

[日本語](README.ja.md)

An MCP server that lets your AI assistant read and control Discord on your computer.

Ask it to read a channel, receive new messages, or turn down someone's volume in a call.

## What you can do

| Tools | Purpose |
| --- | --- |
| `get_guilds`, `get_guild`, `get_channels` | Get server and channel information |
| `get_channel` | Read a channel, DM or group DM |
| `get_selected_voice_channel`, `get_voice_settings` | Check your voice channel and settings |
| `subscribe`, `unsubscribe`, `get_events` | Subscribe to and read messages, voice events and more |
| `select_text_channel`, `select_voice_channel` | Switch channels, join or leave a call |
| `set_voice_settings`, `set_user_voice_settings` | Adjust your audio settings or another participant's local volume |
| `set_activity` | Set or clear Rich Presence |
| `send_activity_join_invite`, `close_activity_request` | Accept or reject activity join requests |
| `set_certified_devices` | Set device information |

## Get started

Supports Windows, macOS and Linux. Requires the Discord desktop app and an available OS credential store (a Secret Service keyring on Linux).

### 1. Install

macOS and Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/ver-1000000/discord-rpc-mcp/main/install.sh | sh
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/ver-1000000/discord-rpc-mcp/main/install.ps1 | iex
```

The installer selects your platform, verifies the download and creates a configuration file. No administrator privileges, Node.js or Bun required. Existing configuration is preserved.

### 2. Connect Discord

Create an application in the [Discord Developer Portal](https://discord.com/developers/applications) and add `http://127.0.0.1:8765/callback` as its OAuth2 redirect URI. Enter the application ID and client secret in the `.env` file at the path printed by the installer.

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

### 3. Add to your MCP client

For Codex (macOS/Linux):

```sh
codex mcp add discord-rpc-mcp -- "$HOME/.local/share/discord-rpc-mcp/bin/discord-rpc-mcp" --env-file "$HOME/.local/share/discord-rpc-mcp/config/.env"
```

For Codex (Windows PowerShell):

```powershell
codex mcp add discord-rpc-mcp -- "$env:LOCALAPPDATA\discord-rpc-mcp\bin\discord-rpc-mcp.exe" --env-file "$env:LOCALAPPDATA\discord-rpc-mcp\config\.env"
```

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

Prefer a manual download? [Latest Release](https://github.com/ver-1000000/discord-rpc-mcp/releases/latest) includes platform archives and an MCPB bundle. For MCPB-compatible clients, open the `.mcpb` file and select the same `.env` file.

---

[Configuration](docs/configuration.md) · [Development](docs/development.md) · [Discord RPC access requirements](https://docs.discord.com/developers/topics/rpc#restrictions)

## Notes

- Only reading is enabled by default. To change volume, switch channels or perform other actions, set `DISCORD_ALLOW_CONTROL=1` in `.env`. See the [configuration guide](docs/configuration.md) for the required authorization scopes
- Messages are limited to what Discord has loaded. Full-history search and normal message sending, editing and deletion are not supported
- Reading messages may move the Discord view
- Retrieved content may be sent to your AI service
- Not affiliated with Discord

## License

[MIT](LICENSE)

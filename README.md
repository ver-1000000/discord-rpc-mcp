<p align="center">
  <img src="assets/icon.svg" width="128" alt="Discord RPC MCP">
</p>

# discord-rpc-mcp

[日本語](README.ja.md)

A server that exposes the Discord desktop app's RPC through MCP. (Functionality follows Discord's RPC capabilities, so features such as searching past chats are not available.)

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
| `toggle_video`, `toggle_screenshare` | Toggle the camera or screen sharing in a call |
| `set_activity` | Set or clear Rich Presence |
| `send_activity_join_invite`, `close_activity_request` | Accept or reject activity join requests |
| `set_certified_devices` | Set device information |

## Setup

To store authorization tokens securely, an OS credential store is required (Secret Service on Linux).

With Node.js 22+, npm and Git installed, register the MCP with your agent client as follows.

```sh
# Codex
codex mcp add discord-rpc-mcp -- npx -y github:ver-1000000/discord-rpc-mcp

# Claude Code
claude mcp add --scope user discord-rpc-mcp -- npx -y github:ver-1000000/discord-rpc-mcp
```

Clients that support [MCPB](https://github.com/modelcontextprotocol/mcpb) can install the `.mcpb` file from [Releases](https://github.com/ver-1000000/discord-rpc-mcp/releases).

Once the MCP is installed and enabled, tell your agent: **Set up discord-rpc-mcp.**
The `setup` tool opens a local page that guides you through creating your own Discord application, enabling **Public Client** and entering its Client ID.

For manual installation or detailed instructions, see the [installation guide](docs/installation.md).

---

[Usage](docs/usage.md) · [Development](docs/development.md) · [Discord RPC access requirements](https://docs.discord.com/developers/topics/rpc#restrictions) · [Terms of Use](docs/terms.md) · [Privacy Policy](docs/privacy.md)

## License

[MIT](LICENSE)

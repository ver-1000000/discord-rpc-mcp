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

Control tools are disabled by default. An agent with local command access can help enable them and configure permissions using the [configuration guide](docs/configuration.md).

Messages are limited to what Discord has loaded. Full-history search and normal message sending, editing and deletion are not supported.

## Get started

Requires Linux, the Discord desktop app and an unlocked desktop keyring.

1. Prepare the executable ([build instructions](docs/development.md))
2. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications) and add `http://127.0.0.1:8765/callback` as its OAuth2 redirect URI
3. Copy [.env.example](.env.example) to `.env` and enter your application ID and client secret
4. Start Discord and run:

```sh
chmod 600 .env
chmod +x discord-rpc-mcp
./discord-rpc-mcp --env-file .env login
```

Approve the request in Discord. Your credentials are saved and reused on subsequent connections.

Add this configuration to your MCP client, replacing the paths with your own:

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

Keep Discord running while using the server.

---

[Configuration](docs/configuration.md) · [Development](docs/development.md) · [Discord RPC access requirements](https://docs.discord.com/developers/topics/rpc#restrictions)

Reading messages may move the Discord view. Retrieved content may be sent to your AI service.

MIT licensed. Not affiliated with Discord.

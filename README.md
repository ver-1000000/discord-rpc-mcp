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
| `set_activity` | Set or clear Rich Presence |
| `send_activity_join_invite`, `close_activity_request` | Accept or reject activity join requests |
| `set_certified_devices` | Set device information |

## Get started

### 1. Install

Send this to an agent with terminal access, such as Codex or Claude Code:

```text
Install discord-rpc-mcp and register it with my current MCP client using this guide:
https://github.com/ver-1000000/discord-rpc-mcp/blob/main/docs/installation.md
```

For manual setup or Claude Desktop, see the [installation guide](docs/installation.md).

### 2. Connect Discord

Complete the Discord settings below. Labels use the English interface. You can reuse an application you have already configured.

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and sign in
2. Select `New Application` > enter a name such as `RPC MCP Bridge` in `Name` > review and accept the terms > `Create`
3. In the left menu, select `OAuth2` > `Redirects` > `Add Redirect` > enter `http://127.0.0.1:8765/callback` > `Save Changes`
4. On the same `OAuth2` page, select `Client ID` > `Copy`, then paste it after `DISCORD_CLIENT_ID=` in the local `.env` file indicated by your agent
5. Copy `Client Secret`, paste it after `DISCORD_CLIENT_SECRET=` in the same file, and save
   - For a new application without an available secret, use `Reset Secret` and complete any identity verification requested
   - Resetting an existing application's secret also requires updating any other integrations using it
6. Start the Discord desktop app on your computer and tell your agent that the configuration is saved and it can continue connecting
7. When Discord shows an authorization prompt, check the application name and requested permissions, then approve

Enter the secret in the local `.env` file, not in chat. For manual login commands, see the [installation guide](docs/installation.md#2-connect-discord).

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

# Usage

For installation and initial setup, see the [installation guide](installation.md). Keep Discord desktop running on the same computer as the MCP server.

## Read channels

Use `get_channel` to read a channel, DM or group DM by channel ID without selecting it in the Discord UI. Messages are limited to what the Discord client has loaded. Full-history search and normal message sending, editing and deletion are not supported.

For summaries or reading across channels, pass `fields` to reduce response size:

```json
{
  "channel_id": "YOUR_CHANNEL_ID",
  "fields": [
    "id", "name",
    "messages.id", "messages.content", "messages.timestamp",
    "messages.author.username",
    "messages.embeds.rawTitle", "messages.embeds.rawDescription", "messages.embeds.url"
  ]
}
```

Paths are relative to `data` and select existing RPC fields without summarizing or rewriting their values. Include embed titles and descriptions when reading link-only posts. Add `messages.attachments.filename` and `messages.attachments.url` when you need attachments.

- Omit `fields` to return the full RPC data
- Use 1–64 dotted paths, each at most 256 characters, with no wildcards or array indices
- Array paths apply to every element, preserving array order and length
- Selecting a parent (for example, `messages.author`) includes its entire value
- Missing fields are omitted; null values and empty arrays remain unchanged
- `metadata` is unaffected; `messageCount` counts messages in the original RPC result even if you omit `messages`

The 2 MiB response limit applies after field selection.

## Permissions and controls

Ask your agent to call `setup` to change permissions. Every setup page opens with all displayed additional permissions selected. Initial setup also enables **Enable controls**; reopening setup preserves this control setting.

**Enable controls** makes tools for changing channels, audio settings, camera, screen sharing, Rich Presence and invitations available to your agent. Hosts may need to refresh their tool list after you change this option.

Under **Advanced options**, uncheck any additional permissions you do not need:

| Permission | Scope |
| --- | --- |
| Change Rich Presence | `rpc.activities.write` |
| Read notifications | `rpc.notifications.read` |
| Read voice events | `rpc.voice.read` |
| Change voice settings | `rpc.voice.write` |
| Read video status | `rpc.video.read` |
| Control camera | `rpc.video.write` |
| Read screen sharing status | `rpc.screenshare.read` |
| Control screen sharing | `rpc.screenshare.write` |

Base scopes `rpc` and `messages.read` are always requested. The separate `voice` scope is not offered for new connections. Discord may restrict access to requested scopes.

New authorization requires approval in Discord. After changing configuration, subscribe to events again because setup closes the existing Discord connection.

## Camera and screen sharing

Use `toggle_video` to toggle the camera in the current call, and `toggle_screenshare` to toggle screen sharing. Select **Enable controls** and the respective write permissions in `setup` first.

Each call inverts the current on/off state. If a request times out or fails, check the state in Discord before trying again.

For `toggle_screenshare`, omit `pid` to choose the sharing source in Discord, or specify the OS process ID of the application to share.

## Credentials and profiles

Authorization uses PKCE with your own application's **Public Client** setting enabled; no Client Secret is needed. Existing connections that use a saved Client Secret remain supported.

Tokens and any previously saved Client Secret are stored in the OS credential store: Credential Manager on Windows, Keychain on macOS, and Secret Service (GNOME Keyring or KWallet) on Linux.

Non-secret settings are saved as `settings.json` in:

| Platform | Directory |
| --- | --- |
| Linux | `$XDG_CONFIG_HOME/discord-rpc-mcp` or `~/.config/discord-rpc-mcp` |
| macOS | `~/Library/Application Support/discord-rpc-mcp` |
| Windows | `%LOCALAPPDATA%/discord-rpc-mcp` |

Set `DISCORD_CONFIG_DIR` in your client's MCP process environment to use another settings directory. All processes using one profile should use the same directory. Avoid concurrent setup from multiple clients.

The CLI `status` command reports saved authorization. `logout` removes the selected profile's credential-store entry. Stop running bridge processes and revoke the application in Discord's Authorized Apps settings to disconnect completely. To remove non-secret settings too, delete the profile's configuration directory.

See the [Privacy Policy](privacy.md) for data sharing and deletion details.

## Events and notifications

### Subscribe and read events

1. Call `subscribe` with an event and its target. Channel events require `channel_id`; `GUILD_STATUS` requires `guild_id`; other events take neither.
2. Call `get_events` to read received events. Pass its `nextCursor` as `after` on the next call. If `hasMore` is true, continue reading to drain the buffered events.
3. Call `unsubscribe` with the same event and target IDs to stop that subscription.

For example, subscribe to new messages in a channel:

```json
{"event": "MESSAGE_CREATE", "channel_id": "YOUR_CHANNEL_ID"}
```

Subscriptions receive events after authorization and subscription; they do not fetch past messages. `get_events` reads the local buffer without connecting to Discord.

The buffer holds at most 100 events or 1 MiB in memory and is discarded when the process exits. A slow reader can miss events. Check `gap` for dropped events, reset `after` to `0` when `streamId` changes, and subscribe again after disconnection. Event results are never a complete message history.

### Receive MCP resource notifications

Hosts that support MCP resource subscriptions can subscribe to `discord://events` using `resources/subscribe`. Buffer changes trigger `notifications/resources/updated`, containing the resource URI. Read the resource for a snapshot, or use `get_events` to read with a cursor. Stop these notifications with `resources/unsubscribe`.

This resource subscription tells the host when to read the buffer; use the `subscribe` tool to request events from Discord. Resource access alone does not connect to Discord. The host decides how to respond to updates.

## Troubleshooting

| Problem | Action |
| --- | --- |
| Setup page does not open | Open the URL provided by your agent on the same computer as the MCP server |
| Setup URL has expired | Call `setup` again; URLs expire after 15 minutes, or 30 seconds after success |
| Discord connection fails after setup | Check that Discord desktop is running, then call `get_guilds` to verify the connection; `setup_status` only checks setup and stored credentials |
| Discord's socket cannot be found automatically | Set `DISCORD_RPC_PATH` in the MCP process environment to the Discord desktop client's socket |
| Linux credential store is unavailable | Start a Secret Service provider in the same desktop session and unlock its default collection; see [GNOME Keyring setup](https://wiki.archlinux.org/title/GNOME/Keyring) or [KWallet setup](https://wiki.archlinux.org/title/KDE_Wallet) |
| Required permission is missing | Reopen `setup` and select it if available, preserving permissions you still need; Discord may refuse to grant it |
| Discord rejects a requested scope | Verify that Client ID belongs to your own application; deselect unneeded additional permissions and retry manually. The required `rpc` and `messages.read` scopes cannot be removed |
| Discord rejects the token exchange | Enable **Public Client** in OAuth2, save changes and check that the registered redirect URL matches the setup page |
| Events stop after reconnecting or changing settings | Call `subscribe` again for the events and targets you need |

[Back to README](../README.md)

# Configuration

## Enabling controls and permissions

An agent with permission to edit local configuration and run commands can perform these steps for the user. A chat-only MCP host cannot run the login command on its own. The user must approve Discord's authorization prompt; do not bypass it or request unrelated scopes.

Set `DISCORD_ALLOW_CONTROL=1` in the environment file to expose navigation, voice, activity and invitation tools, then restart the MCP server. To request additional Discord permissions, preserve existing scopes, add the required scopes to `DISCORD_SCOPES`, and run:

```sh
./discord-rpc-mcp --env-file /absolute/path/config/.env login
```

Supported additional scopes are `rpc.activities.write`, `rpc.notifications.read`, `rpc.voice.read`, `rpc.voice.write` and `voice`. The base scopes `rpc` and `messages.read` are always requested. Discord may restrict scope access. Login replaces stored credentials only after the requested scopes are verified. Tool calls do not open authorization prompts.

Never print client secrets or tokens. Preserve the environment file's restricted permissions. Use the user's existing application configuration rather than inserting a shared secret.

## Credentials

`status` reports stored credential status; it does not test Discord connectivity. `logout` removes stored credentials. Also stop running bridge processes. To revoke authorization, remove the application in Discord's Authorized Apps settings.

Credentials use Windows Credential Manager, macOS Keychain or Linux Secret Service (such as GNOME Keyring or KWallet). On Linux, the service must run in the same desktop session, with an unlocked default collection for first-time storage. No external keyring command is needed. Expiring tokens are refreshed when a client secret is available.

Environment files are loaded only with `--env-file`. If automatic IPC discovery fails, set `DISCORD_RPC_PATH` to the Discord desktop client's socket.

## Events and notifications

Call `subscribe` with an event and its target, for example:

```json
{"event": "MESSAGE_CREATE", "channel_id": "YOUR_CHANNEL_ID"}
```

Call `get_events`, then use `nextCursor` as `after` on the next call. The in-memory buffer holds at most 100 events or 1 MiB. Check the returned gap metadata, reset the cursor when `streamId` changes, and subscribe again after disconnection.

Hosts can separately subscribe to `discord://events` using MCP `resources/subscribe`. Buffer updates, including connection gaps and oversized event drops, trigger `notifications/resources/updated`. Notifications contain only the resource URI. Read the resource for a snapshot or use `get_events` for cursor-based reads. Stop notifications with `resources/unsubscribe`. This is the MCP 2025-11-25 resource subscription interface.

Discord event subscriptions and MCP resource subscriptions are independent. Resource access alone does not connect to Discord. The host decides how to respond to updates.

The bridge does not persist message logs. MCP clients may retain results and send them to an AI provider.

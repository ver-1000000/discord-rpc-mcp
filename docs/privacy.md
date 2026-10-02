# Privacy Policy

## Information and purpose

discord-rpc-mcp processes configuration and credentials (Client ID, tokens, and any previously saved Client Secret) to authenticate with Discord.
It processes requested Discord data and action inputs to carry out MCP operations and event subscriptions.
Depending on permissions and requests, this may include profiles, servers, channels, messages, voice states and settings, notifications, and activities.
The application does not send this data to the maintainer or include analytics.

## Sharing

Authentication requests go to Discord, and RPC operations communicate with your local Discord client.
Requested results and subscribed events are available to your connected MCP client, which may send them to an external AI provider or retain them in history or logs.
Only request information you are authorized to share, and review those services' privacy policies.
Client Secret and tokens are not returned in MCP results.

## Storage and deletion

Credentials are stored in the OS credential store.
Configuration is also stored locally, and both remain until removed.
Discord data is processed in memory; subscribed events use a bounded buffer that is cleared when the process exits.
The bridge does not persist message history or log credentials.

To disconnect, stop the bridge and revoke the application in Discord's Authorized Apps settings.
Use `logout` to remove credentials from the selected store, and delete the configuration directory and any credentials left in other profiles.
See the [usage guide](usage.md#credentials-and-profiles) for details.
Delete copies retained by your MCP client or AI provider through that service.

Questions and bug reports: [GitHub Issues](https://github.com/ver-1000000/discord-rpc-mcp/issues).
Issues are public; do not post credentials or private information there.

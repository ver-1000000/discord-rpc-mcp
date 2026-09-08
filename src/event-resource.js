import { SubscribeRequestSchema, UnsubscribeRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export const eventsUri = 'discord://events';

export function registerEventResource(server, bridge) {
  let subscribed = false;
  server.server.registerCapabilities({ resources: { subscribe: true } });
  server.registerResource('discord-events', eventsUri, {
    mimeType: 'application/json',
    description: 'Snapshot of the bounded Discord event buffer, including cursor and gap metadata. Subscribe to resource updates for change notifications; use get_events for cursor-based reads.',
  }, async () => ({ contents: [{ uri: eventsUri, mimeType: 'application/json', text: JSON.stringify(bridge.readEvents(0, 100)) }] }));
  for (const [schema, enabled] of [[SubscribeRequestSchema, true], [UnsubscribeRequestSchema, false]]) {
    server.server.setRequestHandler(schema, async ({ params }) => {
      if (params.uri !== eventsUri) throw new McpError(ErrorCode.InvalidParams, 'Unknown event resource URI.');
      subscribed = enabled;
      return {};
    });
  }
  const updated = () => {
    if (subscribed) {
      // Delivery failure must not break Discord event ingestion. The buffer remains readable.
      void server.server.sendResourceUpdated({ uri: eventsUri }).catch(() => {});
    }
  };
  bridge.events.on('updated', updated);
  return () => {
    subscribed = false;
    bridge.events.off('updated', updated);
  };
}

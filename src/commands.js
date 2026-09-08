import { z } from 'zod';

const id = z.string().regex(/^\d{17,20}$/);
const text = z.string().max(1024);
const bool = z.boolean().optional();
const obj = z.strictObject;
const number = (min, max) => z.number().min(min).max(max);
const device = max => obj({ device_id: text.optional(), volume: number(0, max).optional() });
const identity = obj({ name: text, url: z.url() });
// Activity fields referenced by SET_ACTIVITY:
// https://docs.discord.com/developers/events/gateway-events#activity-object
const activity = obj({
  name: text.optional(),
  type: z.union([z.literal(0), z.literal(2), z.literal(3), z.literal(5)]).optional(),
  url: z.url().nullable().optional(),
  created_at: z.number().int().nonnegative().optional(),
  application_id: id.optional(),
  status_display_type: z.union([z.literal(0), z.literal(1), z.literal(2)]).nullable().optional()
    .describe('Member-list status text: 0 = application name, 1 = state, 2 = details.'),
  state: text.nullable().optional(), details: text.nullable().optional(),
  state_url: z.url().nullable().optional(), details_url: z.url().nullable().optional(),
  emoji: obj({ name: text, id: id.optional(), animated: bool }).nullable().optional(),
  timestamps: obj({ start: z.number().int().nonnegative().optional(), end: z.number().int().nonnegative().optional() }).optional(),
  assets: obj({
    large_image: text.optional(), large_text: text.optional(), large_url: z.url().optional(),
    small_image: text.optional(), small_text: text.optional(), small_url: z.url().optional(),
    invite_cover_image: text.optional(),
  }).optional(),
  party: obj({ id: text.optional(), size: z.tuple([z.number().int().nonnegative(), z.number().int().positive()]).optional() }).optional(),
  secrets: obj({ join: text.optional(), spectate: text.optional(), match: text.optional() }).optional(),
  buttons: z.array(obj({ label: z.string().min(1).max(32), url: z.url().max(512) })).max(2).optional(),
  instance: bool,
  flags: z.number().int().nonnegative().optional(),
});

function command(cmd, description, shape = {}, control = false, readOnly = !control) {
  return { cmd, name: cmd.toLowerCase(), description, schema: obj(shape), control, readOnly };
}

export const commands = [
  command('GET_GUILDS', 'List guild metadata available to the Discord client.'),
  command('GET_GUILD', 'Get one guild by ID.', { guild_id: id, timeout: z.number().int().min(1).max(10000).optional() }),
  command('GET_CHANNELS', 'List channel metadata for a guild.', { guild_id: id }),
  command('GET_CHANNEL', 'Read a known channel, DM or group DM. Only the client-loaded message window is available; this can move the Discord view. It is not full history or server-side search.', { channel_id: id }, false, false),
  command('GET_SELECTED_VOICE_CHANNEL', 'Get the currently selected voice channel, or null.'),
  command('GET_VOICE_SETTINGS', 'Get local voice settings.'),
  command('SELECT_TEXT_CHANNEL', 'Navigate Discord to a channel, or pass null to deselect.', { channel_id: id.nullable() }, true),
  command('SELECT_VOICE_CHANNEL', 'Join or leave a voice channel. Use force only after the user explicitly approves moving an existing call.', {
    channel_id: id.nullable(), force: bool, navigate: bool,
    timeout: z.number().int().min(1).max(10000).optional(),
  }, true),
  command('SET_USER_VOICE_SETTINGS', 'Change another participant’s local volume, pan or mute state.', {
    user_id: id, volume: number(0, 200).int().optional(), mute: bool,
    pan: obj({ left: number(0, 1), right: number(0, 1) }).optional(),
  }, true),
  command('SET_VOICE_SETTINGS', 'Change local microphone, speaker and voice settings. Affects ongoing calls.', {
    input: device(100).optional(), output: device(200).optional(),
    mode: obj({
      type: z.enum(['PUSH_TO_TALK', 'VOICE_ACTIVITY']).optional(),
      auto_threshold: bool, threshold: number(-100, 0).optional(), delay: number(0, 2000).optional(),
      shortcut: z.array(obj({ type: z.number().int().min(0).max(2), code: z.number().int().nonnegative(), name: text })).max(16).optional(),
    }).optional(),
    automatic_gain_control: bool, echo_cancellation: bool, noise_suppression: bool,
    qos: bool, silence_warning: bool, deaf: bool, mute: bool,
  }, true),
  command('SET_CERTIFIED_DEVICES', 'Set certified device information for the connected application.', {
    devices: z.array(obj({
      type: z.enum(['audioinput', 'audiooutput', 'videoinput']), id: text,
      vendor: identity, model: identity, related: z.array(text).max(32),
      echo_cancellation: bool, noise_suppression: bool, automatic_gain_control: bool, hardware_mute: bool,
    })).max(32),
  }, true),
  command('SET_ACTIVITY', 'Update externally visible Rich Presence, or use null to clear it.', {
    pid: z.number().int().positive(), activity: activity.nullable(),
  }, true),
  command('SEND_ACTIVITY_JOIN_INVITE', 'Accept a user’s Rich Presence Ask to Join request. This is not a normal message.', { user_id: id }, true),
  command('CLOSE_ACTIVITY_REQUEST', 'Reject a user’s Rich Presence Ask to Join request.', { user_id: id }, true),
];

const channelEvents = [
  'VOICE_STATE_CREATE', 'VOICE_STATE_UPDATE', 'VOICE_STATE_DELETE', 'SPEAKING_START', 'SPEAKING_STOP',
  'MESSAGE_CREATE', 'MESSAGE_UPDATE', 'MESSAGE_DELETE',
];
const globalEvents = [
  'CURRENT_USER_UPDATE', 'RELATIONSHIP_UPDATE', 'GUILD_CREATE', 'CHANNEL_CREATE',
  'VOICE_CHANNEL_SELECT', 'VOICE_SETTINGS_UPDATE', 'VOICE_CONNECTION_STATUS', 'NOTIFICATION_CREATE',
  'ACTIVITY_JOIN', 'ACTIVITY_SPECTATE', 'ACTIVITY_JOIN_REQUEST', 'ACTIVITY_INVITE',
  'ENTITLEMENT_CREATE', 'ENTITLEMENT_DELETE',
];
export const eventNames = ['GUILD_STATUS', ...channelEvents, ...globalEvents];
export const subscriptionSchema = obj({
  event: z.enum(eventNames),
  channel_id: id.optional(),
  guild_id: id.optional(),
}).superRefine((value, context) => {
  const channel = channelEvents.includes(value.event);
  const guild = value.event === 'GUILD_STATUS';
  if ((value.channel_id !== undefined) !== channel || (value.guild_id !== undefined) !== guild) {
    context.addIssue({ code: 'custom', message: 'Channel events require only channel_id; GUILD_STATUS requires only guild_id; other events take neither.' });
  }
});

export const eventsSchema = obj({
  after: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(100).default(20),
});

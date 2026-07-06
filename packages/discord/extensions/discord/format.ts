import type { DiscordChannel, DiscordMessage, ReadMessagesResult } from './client/channels.js';
import type { DownloadedAttachment } from './client/attachments.js';

// ---------------------------------------------------------------------------
// Channel type labels
// ---------------------------------------------------------------------------

const CHANNEL_TYPE_LABEL: Record<number, string> = {
  0: '#',
  5: '📣',
  10: '🧵',
  11: '🧵',
  12: '🧵',
  15: '🗂️',
};

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export function formatChannelList(channels: DiscordChannel[], guildId: string): string {
  if (channels.length === 0) return `No text channels found in guild ${guildId}.`;

  const lines = channels.map((ch) => {
    const marker = CHANNEL_TYPE_LABEL[ch.type] ?? '#';
    const topic = ch.topic ? ` — ${ch.topic}` : '';
    return `${marker} **${ch.name}** (${ch.id})${topic}`;
  });

  return `**Channels** in guild ${guildId} (${channels.length}):\n\n${lines.join('\n')}`;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, ' UTC');
}

function formatSingleMessage(msg: DiscordMessage): string {
  const time = formatTimestamp(msg.timestamp);
  const bot = msg.isBot ? ' [bot]' : '';
  const edited = msg.editedTimestamp ? ' (edited)' : '';
  const reactions = msg.reactions
    ? ` ${msg.reactions.map((r) => `${r.name} ${r.count}`).join(' ')}`
    : '';
  const attachments = msg.attachments
    ? `\n  📎 ${msg.attachments.map((a) => `${a.filename} (${a.url})`).join(', ')}`
    : '';

  return `[${time}] **${msg.author}**${bot}${edited}: ${msg.content}${reactions}${attachments}`;
}

export function formatMessages(result: ReadMessagesResult, channelId: string): string {
  if (result.messages.length === 0) return `No messages found in channel ${channelId}.`;

  // Discord returns newest-first; present oldest-first for readability.
  const ordered = [...result.messages].reverse();
  const header = `**Messages** in ${channelId} (${ordered.length}):`;
  const msgs = ordered.map(formatSingleMessage);

  return `${header}\n\n${msgs.join('\n\n')}`;
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export function formatDownloadedAttachment(result: DownloadedAttachment): string {
  const header = `📎 **${result.filename}**`;
  const hint = result.isImage
    ? `\n\n💡 This is an image. Use the \`read\` tool to view it:\n  \`read ${result.localPath}\``
    : `\n\n📁 Downloaded to: ${result.localPath}`;

  return `${header}${hint}`;
}

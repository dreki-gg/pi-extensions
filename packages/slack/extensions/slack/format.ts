import type { SlackChannel, SlackMessage, ReadMessagesResult } from './client/channels.js';
import type { SearchResult } from './client/search.js';
import type { DownloadedFile, SlackFileInfo } from './client/files.js';
import type {
  PostMessageResult,
  EditMessageResult,
  DeleteMessageResult,
} from './client/messages.js';

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export function formatChannelList(channels: SlackChannel[]): string {
  if (channels.length === 0) return 'No channels found.';

  const lines = channels.map((ch) => {
    const visibility = ch.isPrivate ? '🔒' : '#';
    const members = `${ch.numMembers} members`;
    const topic = ch.topic ? ` — ${ch.topic}` : '';
    return `${visibility} **${ch.name}** (${ch.id}) · ${members}${topic}`;
  });

  return `**Channels** (${channels.length}):\n\n${lines.join('\n')}`;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

function formatTimestamp(ts: string): string {
  const date = new Date(Number(ts) * 1000);
  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, ' UTC');
}

function formatSingleMessage(msg: SlackMessage): string {
  const time = formatTimestamp(msg.ts);
  const thread = msg.replyCount ? ` [${msg.replyCount} replies]` : '';
  const reactions = msg.reactions
    ? ` ${msg.reactions.map((r) => `:${r.name}: ${r.count}`).join(' ')}`
    : '';
  const files = msg.files ? `\n  📎 ${msg.files.map((f) => `${f.name} (${f.id})`).join(', ')}` : '';

  return `[${time}] **${msg.user}**${thread}: ${msg.text}${reactions}${files}`;
}

export function formatMessages(result: ReadMessagesResult, channelId: string): string {
  if (result.messages.length === 0) return `No messages found in channel ${channelId}.`;

  const header = `**Messages** in ${channelId} (${result.messages.length}${result.hasMore ? ', more available' : ''}):`;
  const msgs = result.messages.map(formatSingleMessage);

  return `${header}\n\n${msgs.join('\n\n')}`;
}

export function formatThread(
  result: ReadMessagesResult,
  channelId: string,
  threadTs: string,
): string {
  if (result.messages.length === 0) return `No replies found in thread ${threadTs}.`;

  const header = `**Thread** ${threadTs} in ${channelId} (${result.messages.length} messages${result.hasMore ? ', more available' : ''}):`;
  const msgs = result.messages.map(formatSingleMessage);

  return `${header}\n\n${msgs.join('\n\n')}`;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export function formatSearchResults(result: SearchResult, query: string): string {
  if (result.matches.length === 0) return `No results found for "${query}".`;

  const header = `**Search results** for "${query}" (${result.matches.length} of ${result.total} total):`;
  const matches = result.matches.map((m) => {
    const time = formatTimestamp(m.ts);
    return `[${time}] **${m.user}** in #${m.channel.name}: ${m.text}\n  🔗 ${m.permalink}`;
  });

  return `${header}\n\n${matches.join('\n\n')}`;
}

// ---------------------------------------------------------------------------
// Posting
// ---------------------------------------------------------------------------

export function formatPostedMessage(result: PostMessageResult, threadTs?: string): string {
  const where = threadTs ? `thread ${threadTs} in ${result.channel}` : `${result.channel}`;
  return `✅ Message posted to ${where} (ts: ${result.ts})`;
}

export function formatEditedMessage(result: EditMessageResult): string {
  return `✏️ Message edited in ${result.channel} (ts: ${result.ts})`;
}

export function formatDeletedMessage(result: DeleteMessageResult): string {
  return `🗑️ Message deleted in ${result.channel} (ts: ${result.ts})`;
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export function formatFileInfo(info: SlackFileInfo): string {
  const size = formatFileSize(info.size);
  const dims = info.isImage && info.imageWidth ? ` · ${info.imageWidth}×${info.imageHeight}` : '';

  return `📎 **${info.title}** (${info.name})\n  Type: ${info.mimetype} · Size: ${size}${dims}\n  ID: ${info.id}\n  🔗 ${info.permalink}`;
}

export function formatDownloadedFile(result: DownloadedFile): string {
  const info = formatFileInfo(result.info);
  const hint = result.info.isImage
    ? `\n\n💡 This is an image file. Use the \`read\` tool to view it:\n  \`read ${result.localPath}\``
    : `\n\n📁 Downloaded to: ${result.localPath}`;

  return `${info}${hint}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

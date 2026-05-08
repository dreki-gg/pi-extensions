import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';

const MAX_MESSAGES = 40;

export function extractRecentConversation(ctx: ExtensionCommandContext): string {
  const entries = ctx.sessionManager.getBranch();
  const messages: string[] = [];

  for (const entry of entries) {
    if (entry.type !== 'message') continue;
    const msg = entry.message;
    if (!msg) continue;

    if (msg.role === 'user' || msg.role === 'assistant') {
      const content = Array.isArray(msg.content) ? msg.content : [];
      const textParts = content
        .filter((part: { type: string }) => part.type === 'text')
        .map((part: { type: string; text?: string }) => (part as { text: string }).text)
        .join('\n');

      if (textParts.trim()) {
        messages.push(`[${msg.role}]\n${textParts.trim()}`);
      }
    }
  }

  return messages.slice(-MAX_MESSAGES).join('\n\n---\n\n');
}

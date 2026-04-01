import type { ExtensionCommandContext } from '@mariozechner/pi-coding-agent';

const MAX_MESSAGES = 40;

const SYNTHESIS_INSTRUCTION = `Synthesize the current conversation into a clear task specification for a team of subagents that will execute it.

Your synthesis MUST capture:

1. **Goal** — What are we building, changing, or investigating?
2. **Decisions made** — Every locked choice, preference, or constraint the user confirmed.
3. **Constraints** — What was explicitly rejected and why.
4. **Architecture** — The agreed structure, file layout, data flow, or integration shape.
5. **Open questions** — Anything flagged but not resolved yet.
6. **Intent** — The user's real motivation and the nuance behind the decisions.

Be specific and actionable. Do NOT summarize vaguely. Include concrete names, paths, tools, APIs, and patterns that were discussed.

The output should be usable by agents who have NOT seen this conversation.

Format:

## Goal
<one paragraph>

## Decisions
<bulleted list of every locked decision>

## Constraints
<bulleted list of what was rejected and why>

## Architecture
<concrete structure, files, data flow>

## Open Questions
<anything unresolved>

## Intent
<the user's real motivation>`;

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

export function buildSynthesisPrompt(conversation: string, explicitTask?: string): string {
  const parts = [SYNTHESIS_INSTRUCTION];

  if (explicitTask) {
    parts.push(`\nThe user explicitly specified the task as:\n${explicitTask}`);
    parts.push(
      '\nUse this as the primary goal, but enrich it with relevant context from the conversation.',
    );
  }

  parts.push(`\n\n## Conversation\n\n${conversation}`);

  return parts.join('\n');
}

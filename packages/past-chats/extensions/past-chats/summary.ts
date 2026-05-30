import { readFileSync } from 'node:fs';
import { complete, type Message } from '@earendil-works/pi-ai';
import { type ExtensionContext, type FileEntry } from '@earendil-works/pi-coding-agent';
import { findCacheEntry, loadCache, saveCache, upsertCacheEntry } from './cache';
import type { PastChatItem, PastChatsConfig } from './types';

export const SUMMARY_VERSION = 'past-chats-summary-v1';
const MAX_SECTION_CHARS = 5_000;
const MAX_SNIPPETS = 8;

function truncate(text: string, max = MAX_SECTION_CHARS): string {
  const trimmed = text.replace(/\n{3,}/g, '\n\n').trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 3)}...` : trimmed;
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .flatMap((block) => {
      if (!block || typeof block !== 'object') return [];
      const candidate = block as { type?: string; text?: string; thinking?: string; name?: string; arguments?: unknown };
      if (candidate.type === 'text' && typeof candidate.text === 'string') return [candidate.text];
      return [];
    })
    .join('\n');
}

function toolCallLines(content: unknown): string[] {
  if (!Array.isArray(content)) return [];
  return content.flatMap((block) => {
    if (!block || typeof block !== 'object') return [];
    const candidate = block as { type?: string; name?: string; arguments?: unknown };
    if (candidate.type !== 'toolCall' || typeof candidate.name !== 'string') return [];
    const args = JSON.stringify(candidate.arguments ?? {});
    return [`- ${candidate.name} ${args.length > 240 ? `${args.slice(0, 237)}...` : args}`];
  });
}

function unique(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines.filter((line) => {
    const normalized = line.trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export function loadSessionEntries(sessionPath: string): FileEntry[] {
  try {
    return readFileSync(sessionPath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as FileEntry);
  } catch (err) {
    console.warn(`[past-chats] Failed to read session ${sessionPath}:`, err);
    return [];
  }
}

export function buildDeterministicSummary(item: PastChatItem, entries = loadSessionEntries(item.session.path)): string {
  const compactions: string[] = [];
  const branchSummaries: string[] = [];
  const recentUser: string[] = [];
  const assistant: string[] = [];
  const tools: string[] = [];

  for (const entry of entries) {
    if (entry.type === 'compaction') compactions.push(`- ${truncate(entry.summary, 900)}`);
    if (entry.type === 'branch_summary') branchSummaries.push(`- ${truncate(entry.summary, 900)}`);

    if (entry.type !== 'message') continue;
    const message = entry.message as { role?: string; content?: unknown };
    const role = message.role;
    const text = truncate(textFromContent(message.content), 700);
    if (role === 'user' && text) recentUser.push(`- ${text}`);
    if (role === 'assistant' && text) assistant.push(`- ${text}`);
    if (role === 'assistant') tools.push(...toolCallLines(message.content));
  }

  const sections: string[] = [];
  sections.push(`### Deterministic handoff summary`);
  sections.push(`Title: ${item.title}`);

  const latestCompactions = compactions.slice(-2);
  if (latestCompactions.length) sections.push(`\nCompaction summaries:\n${latestCompactions.join('\n')}`);

  const latestBranches = branchSummaries.slice(-2);
  if (latestBranches.length) sections.push(`\nBranch summaries:\n${latestBranches.join('\n')}`);

  const latestUser = recentUser.slice(-MAX_SNIPPETS);
  if (latestUser.length) sections.push(`\nRecent user messages:\n${latestUser.join('\n')}`);

  const latestAssistant = assistant.slice(-5);
  if (latestAssistant.length) sections.push(`\nRecent assistant notes:\n${latestAssistant.join('\n')}`);

  const uniqueTools = unique(tools).slice(-MAX_SNIPPETS);
  if (uniqueTools.length) sections.push(`\nTool calls / points of interest:\n${uniqueTools.join('\n')}`);

  if (sections.length === 2 && item.session.firstMessage) {
    sections.push(`\nFirst message:\n- ${truncate(item.session.firstMessage, 1_000)}`);
  }

  return truncate(sections.join('\n'), 10_000);
}

function buildAiSummaryPrompt(item: PastChatItem): string {
  const allText = item.session.allMessagesText?.slice(-20_000) ?? item.session.firstMessage ?? '';
  return [
    'Generate a concise handoff for this previous Pi session.',
    'Include goals, key decisions, files/tools mentioned, points of interest, open questions, and where to inspect deeper.',
    'Do not invent details. Keep it under 800 words.',
    '',
    `Session file: ${item.session.path}`,
    `Session title: ${item.title}`,
    `CWD: ${item.session.cwd}`,
    `Modified: ${item.session.modified.toISOString()}`,
    '',
    '<conversation_text>',
    allText,
    '</conversation_text>',
  ].join('\n');
}

async function buildAiSummary(ctx: ExtensionContext, item: PastChatItem, config: PastChatsConfig): Promise<string | undefined> {
  const provider = config.summary?.provider;
  const modelId = config.summary?.model;
  if (!provider || !modelId) return undefined;

  const model = ctx.modelRegistry.find(provider, modelId);
  if (!model) {
    if (ctx.hasUI) ctx.ui.notify(`past-chats: model not found: ${provider}/${modelId}`, 'warning');
    return undefined;
  }

  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok || !auth.apiKey) {
    if (ctx.hasUI) ctx.ui.notify(`past-chats: ${auth.ok ? `No API key for ${provider}/${modelId}` : auth.error}`, 'warning');
    return undefined;
  }

  const message: Message = {
    role: 'user',
    content: [{ type: 'text', text: buildAiSummaryPrompt(item) }],
    timestamp: Date.now(),
  };

  const response = await complete(
    model,
    {
      systemPrompt: 'You write compact, factual handoff summaries for coding-agent sessions.',
      messages: [message],
    },
    { apiKey: auth.apiKey, headers: auth.headers, signal: ctx.signal },
  );

  if (response.stopReason === 'aborted') return undefined;
  return response.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

export async function getSummaryForItem(
  ctx: ExtensionContext,
  cwd: string,
  config: PastChatsConfig,
  item: PastChatItem,
  options: { forceAi?: boolean } = {},
): Promise<string> {
  if (!config.summary?.ai && !options.forceAi) return buildDeterministicSummary(item);

  const provider = config.summary?.provider;
  const model = config.summary?.model;
  const key = {
    path: item.session.path,
    modified: item.session.modified.toISOString(),
    version: SUMMARY_VERSION,
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
  };
  const cache = loadCache(cwd);
  const cached = findCacheEntry(cache, key);
  if (cached) return cached.summary;

  try {
    const aiSummary = await buildAiSummary(ctx, item, config);
    if (aiSummary) {
      saveCache(
        cwd,
        upsertCacheEntry(cache, {
          ...key,
          summary: aiSummary,
          generatedAt: new Date().toISOString(),
        }),
      );
      return aiSummary;
    }
  } catch (err) {
    console.warn('[past-chats] AI summary failed:', err);
    if (ctx.hasUI) ctx.ui.notify('past-chats: AI summary failed; using deterministic fallback.', 'warning');
  }

  return buildDeterministicSummary(item);
}

export function buildContextPack(item: PastChatItem, summary: string): string {
  return [
    `## Referenced past chat: ${item.token} — ${item.title}`,
    `- Session file: ${item.session.path}`,
    `- CWD: ${item.session.cwd || item.source.cwd}`,
    `- Source: ${item.source.label}`,
    `- Created: ${item.session.created.toISOString()}`,
    `- Modified: ${item.session.modified.toISOString()}`,
    `- Messages: ${item.session.messageCount}`,
    '',
    summary,
    '',
    '### How to dig deeper',
    'If more detail is needed, use the read tool on the session file and inspect relevant entries/timestamps.',
  ].join('\n');
}

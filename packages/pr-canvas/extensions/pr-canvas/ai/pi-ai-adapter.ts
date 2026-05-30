import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type CreateAgentSessionOptions,
  type ExtensionCommandContext,
} from '@earendil-works/pi-coding-agent';
import type { AiChatFn } from '../server/handlers';

const DEFAULT_TIMEOUT_MS = 45_000;

export interface PiAiChatOptions {
  timeoutMs?: number;
  thinkingLevel?: CreateAgentSessionOptions['thinkingLevel'];
}

/**
 * Build a request/response AI function backed by Pi's current model.
 *
 * The nested session is intentionally isolated: no extensions, no tools, no
 * prompt templates, and in-memory session storage. This avoids recursive PR
 * Canvas loading and prevents summary/chat requests from polluting the user's
 * active Pi conversation.
 */
export function createPiAiChatFn(
  ctx: ExtensionCommandContext,
  options: PiAiChatOptions = {},
): AiChatFn | undefined {
  if (!ctx.model) return undefined;

  try {
    if (!ctx.modelRegistry.hasConfiguredAuth(ctx.model)) return undefined;
  } catch {
    return undefined;
  }

  const model = ctx.model;
  const thinkingLevel = options.thinkingLevel;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async (message: string, context: string) => {
    const agentDir = getAgentDir();
    const settingsManager = SettingsManager.create(ctx.cwd, agentDir);
    const resourceLoader = new DefaultResourceLoader({
      cwd: ctx.cwd,
      agentDir,
      settingsManager,
      noExtensions: true,
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
      noContextFiles: true,
      systemPrompt: [
        'You are PR Canvas, a concise pull-request review assistant.',
        'Use only the provided PR context. Do not call tools.',
        'When asked for JSON, return strict JSON only with no Markdown fence.',
        'For Mermaid, use simple valid syntax, no HTML labels, and no semicolons in sequence messages.',
      ].join('\n'),
    });
    await resourceLoader.reload();

    const { session } = await createAgentSession({
      cwd: ctx.cwd,
      agentDir,
      model,
      thinkingLevel,
      modelRegistry: ctx.modelRegistry,
      settingsManager,
      resourceLoader,
      sessionManager: SessionManager.inMemory(ctx.cwd),
      noTools: 'all',
    });

    try {
      await withTimeout(
        session.prompt(`${message}\n\nPR context:\n${context}`, {
          expandPromptTemplates: false,
          source: 'extension',
        }),
        timeoutMs,
      );

      const text = extractLastAssistantText(session);
      if (!text.trim()) throw new Error('AI returned an empty response');
      return text;
    } finally {
      session.dispose();
    }
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`AI request timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function extractLastAssistantText(session: AgentSession): string {
  const messages = [...session.messages].reverse();
  for (const message of messages) {
    const record = message as { role?: string; content?: unknown };
    if (record.role !== 'assistant') continue;
    return extractText(record.content);
  }
  return '';
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && 'type' in part && part.type === 'text') {
        return String((part as { text?: unknown }).text ?? '');
      }
      return '';
    })
    .join('');
}

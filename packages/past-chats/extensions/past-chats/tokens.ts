import { createHash } from 'node:crypto';

export const TOKEN_PREFIXES = ['@session:', '@chat:'] as const;
export type TokenPrefix = (typeof TOKEN_PREFIXES)[number];

export type ActiveToken = {
  prefix: TokenPrefix;
  query: string;
  tokenStart: number;
  token: string;
};

const TOKEN_RE = /(^|[\s([{])(@(?:session|chat):([A-Za-z0-9_-]*))/g;

export function hashSessionPath(sessionPath: string, length = 12): string {
  return createHash('sha256').update(sessionPath).digest('hex').slice(0, length);
}

export function buildToken(prefix: TokenPrefix, id: string): string {
  return `${prefix}${id}`;
}

export function parseReferenceId(token: string): string | undefined {
  const prefix = TOKEN_PREFIXES.find((candidate) => token.startsWith(candidate));
  if (!prefix) return undefined;
  const id = token.slice(prefix.length).trim();
  return id || undefined;
}

export function findActiveToken(textBeforeCursor: string): ActiveToken | undefined {
  const match = textBeforeCursor.match(/(?:^|[\s([{])(@(?:session|chat):([^\s\])},;]*))$/);
  if (!match) return undefined;

  const token = match[1] ?? '';
  const prefix = token.startsWith('@chat:') ? '@chat:' : '@session:';
  return {
    prefix,
    query: match[2] ?? '',
    tokenStart: textBeforeCursor.length - token.length,
    token,
  };
}

export function extractReferenceTokens(text: string): string[] {
  const tokens = new Set<string>();
  for (const match of text.matchAll(TOKEN_RE)) {
    const token = match[2];
    if (token && parseReferenceId(token)) tokens.add(token);
  }
  return [...tokens];
}

/**
 * `@plan:<slug>` reference tokens.
 *
 * Lets a user reference a plan inside a normal chat message (e.g.
 * "start working on @plan:add-auth"). Mirrors the past-chats `@chat:` /
 * `@session:` token model: a cursor-anchored matcher drives autocomplete, and a
 * global matcher extracts referenced slugs from a submitted prompt.
 *
 * Pure module — no IO, safe to unit test.
 */

export const PLAN_TOKEN_PREFIX = '@plan:' as const;

/** Plan slugs are kebab-ish identifiers. */
const SLUG_CHARS = 'A-Za-z0-9_-';

export interface ActivePlanToken {
  /** The query typed after the prefix (may be empty). */
  query: string;
  /** The full token under the cursor, including the prefix. */
  token: string;
  /** Offset in the line where the token starts. */
  tokenStart: number;
}

export function buildPlanToken(slug: string): string {
  return `${PLAN_TOKEN_PREFIX}${slug}`;
}

/** Extract the slug from a `@plan:<slug>` token, or undefined when invalid. */
export function parsePlanSlug(token: string): string | undefined {
  if (!token.startsWith(PLAN_TOKEN_PREFIX)) return undefined;
  const slug = token.slice(PLAN_TOKEN_PREFIX.length).trim();
  return slug || undefined;
}

// Token must be at a word boundary: start of line or after whitespace / open
// bracket. Prevents matching inside emails like `me@plan-x.dev`.
const ACTIVE_RE = new RegExp(`(?:^|[\\s([{])(${PLAN_TOKEN_PREFIX}([${SLUG_CHARS}]*))$`);
const GLOBAL_RE = new RegExp(
  `(?:^|[\\s([{])(${PLAN_TOKEN_PREFIX}([${SLUG_CHARS}]+))`,
  'g',
);

/** Detect a `@plan:` token being typed immediately before the cursor. */
export function findActivePlanToken(textBeforeCursor: string): ActivePlanToken | undefined {
  const match = textBeforeCursor.match(ACTIVE_RE);
  if (!match) return undefined;
  const token = match[1] ?? '';
  return {
    query: match[2] ?? '',
    token,
    tokenStart: textBeforeCursor.length - token.length,
  };
}

/** All `@plan:<slug>` tokens in a message, in order, de-duplicated by slug. */
export function extractPlanReferences(text: string): string[] {
  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(GLOBAL_RE)) {
    const token = match[1];
    const slug = token ? parsePlanSlug(token) : undefined;
    if (token && slug && !seen.has(slug)) {
      seen.add(slug);
      tokens.push(token);
    }
  }
  return tokens;
}

/** First referenced slug in a message (first-wins), or undefined. */
export function firstPlanReference(text: string): string | undefined {
  const [first] = extractPlanReferences(text);
  return first ? parsePlanSlug(first) : undefined;
}

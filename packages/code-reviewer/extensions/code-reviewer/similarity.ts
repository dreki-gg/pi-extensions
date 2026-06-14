/**
 * Deterministic finding-similarity helpers, shared by the pass bucketer and the
 * recorded-rejection matcher. Kept dependency-free and pure so both the
 * Bugbot-style vote pipeline and the rejection store reason about "is this the
 * same bug?" identically.
 */

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'into',
  'when',
  'where',
  'which',
  'while',
  'will',
  'would',
  'could',
  'should',
  'using',
  'can',
  'may',
  'might',
  'a',
  'an',
  'is',
  'of',
  'to',
  'in',
  'on',
  'it',
  'be',
  'as',
  'at',
  'or',
  'if',
  'so',
]);

/** Tokenize a finding message for similarity comparison. */
export function tokenize(message: string): Set<string> {
  const tokens = message
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
  return new Set(tokens);
}

export function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 && right.size === 0) return 1;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Two findings are "the same bug" when they touch the same file and either sit
 *  within a few lines (a strong co-location signal, so only a MODEST text
 *  overlap is needed to fuse paraphrases) or — when a line is missing — read
 *  clearly similar. The lower co-located bar matters: independent passes word
 *  the same defect very differently, and Bugbot leans on an LLM to merge them;
 *  co-location is our deterministic stand-in for that judgment. */
export function sameBug(
  candidate: { file: string; line?: number; tokens: Set<string> },
  bucket: { file: string; line?: number; tokens: Set<string> },
): boolean {
  if (candidate.file !== bucket.file) return false;
  const similarity = jaccard(candidate.tokens, bucket.tokens);
  if (candidate.line !== undefined && bucket.line !== undefined) {
    if (Math.abs(candidate.line - bucket.line) > 3) return false;
    return similarity >= 0.25;
  }
  // One side has no line to anchor on — demand a clearer textual match.
  return similarity >= 0.5;
}

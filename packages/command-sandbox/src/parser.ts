/**
 * Shell command parser using shell-quote.
 *
 * Splits a full shell command string into individual command segments,
 * properly handling &&, ||, ;, |, pipes, quotes, and subshells.
 */

import { parse } from 'shell-quote';

/** Operators that separate independent commands. */
const COMMAND_SEPARATORS = new Set(['&&', '||', ';', '|']);

/** Operators that indicate potentially dangerous constructs. */
const DANGEROUS_OPS = new Set(['>', '>>']);

/** Grouping operators (subshells) — we strip them and validate inner commands. */
const GROUPING_OPS = new Set(['(', ')']);

export interface ParsedSegment {
  /** The reconstructed command string for this segment. */
  command: string;
  /** Whether this segment contains a redirect operator. */
  hasRedirect: boolean;
}

/**
 * Parse a shell command into individual command segments.
 *
 * Uses shell-quote to properly tokenize the input, then splits on
 * command separators (&&, ||, ;, |). Each segment is returned as a
 * reconstructed command string.
 *
 * Subshell grouping operators `(` and `)` are stripped — the inner
 * commands are still validated individually.
 *
 * @example
 * ```ts
 * parseCommandSegments('cd foo && ls -la')
 * // → [{ command: 'cd foo', hasRedirect: false },
 * //    { command: 'ls -la', hasRedirect: false }]
 *
 * parseCommandSegments('echo "hello && world"')
 * // → [{ command: 'echo "hello && world"', hasRedirect: false }]
 *
 * parseCommandSegments('curl -s url 2>/dev/null | head')
 * // → [{ command: 'curl -s url 2>/dev/null', hasRedirect: false },
 * //    { command: 'head', hasRedirect: false }]
 * ```
 */
export function parseCommandSegments(input: string): ParsedSegment[] {
  const tokens = parse(input);
  const segments: ParsedSegment[] = [];
  let currentTokens: string[] = [];
  let hasRedirect = false;

  function flushSegment(): void {
    if (currentTokens.length > 0) {
      segments.push({
        command: currentTokens.join(' '),
        hasRedirect,
      });
      currentTokens = [];
      hasRedirect = false;
    }
  }

  for (const token of tokens) {
    if (typeof token === 'string') {
      currentTokens.push(token);
      continue;
    }

    // Token is an operator object: { op: string }
    if (!('op' in token)) {
      // Unknown token shape — treat as string
      currentTokens.push(String(token));
      continue;
    }

    const { op } = token;

    if (COMMAND_SEPARATORS.has(op)) {
      flushSegment();
      continue;
    }

    if (DANGEROUS_OPS.has(op)) {
      // Check if this is a stderr redirect to /dev/null (e.g. 2>/dev/null)
      // shell-quote splits "2>/dev/null" into tokens: "2", {op:">"}, "/dev/null"
      // This is safe — it just silences stderr output
      const prevToken = currentTokens[currentTokens.length - 1];
      const nextToken = tokens[tokens.indexOf(token) + 1];
      const isStderrToDevNull =
        prevToken === '2' &&
        op === '>' &&
        typeof nextToken === 'string' &&
        nextToken === '/dev/null';

      if (!isStderrToDevNull) {
        hasRedirect = true;
      }
      // Keep the redirect in the current segment for pattern matching
      currentTokens.push(op);
      continue;
    }

    if (GROUPING_OPS.has(op)) {
      // Strip subshell parens — inner commands are still validated
      continue;
    }

    // Any other operator (e.g. glob) — include as text
    currentTokens.push(op);
  }

  flushSegment();
  return segments;
}

/**
 * Check if the parsed tokens contain command substitution patterns.
 *
 * Command substitution ($(...) or `...`) can hide arbitrary commands
 * and should be blocked in sandboxed modes.
 */
export function hasCommandSubstitution(input: string): boolean {
  // shell-quote doesn't fully parse $() — check the raw string
  // but respect quoted strings
  return /\$\(/.test(input) || /`[^`]+`/.test(input);
}

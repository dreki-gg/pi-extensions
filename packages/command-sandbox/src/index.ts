/**
 * @dreki-gg/pi-command-sandbox
 *
 * Shared command sandboxing utilities for pi extensions.
 * Validates shell commands against safe/destructive pattern lists
 * using proper shell parsing via shell-quote.
 */

export { isSafeCommand, type SandboxOptions } from './sandbox.js';
export { parseCommandSegments, hasCommandSubstitution, type ParsedSegment } from './parser.js';
export { DESTRUCTIVE_PATTERNS, SAFE_PATTERNS } from './patterns.js';

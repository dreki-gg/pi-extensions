/**
 * Content resolution for CLI commands that accept markdown / JSON payloads from
 * a foreign harness: an inline string, a file path, or piped stdin.
 */

import { readFile } from 'node:fs/promises';
import { CliError } from './runtime.js';

/** Read all of stdin as a UTF-8 string (used when neither inline nor file is given). */
export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Resolve payload content from, in priority order: an inline value, a `--file`
 * path (or `-` for stdin), else piped stdin. Throws `CliError` when nothing is
 * provided and stdin is a TTY (no piped input).
 */
export async function resolveContent(
  inline: string | undefined,
  file: string | undefined,
  label: string,
): Promise<string> {
  if (inline !== undefined) return inline;
  if (file !== undefined && file !== '-') {
    try {
      return await readFile(file, 'utf8');
    } catch {
      throw new CliError(`Could not read ${label} file: ${file}`);
    }
  }
  if (process.stdin.isTTY) {
    throw new CliError(`No ${label} provided. Pass it inline, via --${label}-file, or on stdin.`);
  }
  return readStdin();
}

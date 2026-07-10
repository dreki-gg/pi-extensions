import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LARGE_JSON_BYTES = 4_000;

/** Write full JSON payload to a temp file. Returns absolute path. */
export async function writeJsonSpill(payload: unknown, prefix = 'firestore'): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'firestore-cli-'));
  const path = join(dir, `${prefix}-${Date.now()}.json`);
  await writeFile(path, JSON.stringify(payload, null, 2), 'utf-8');
  return path;
}

export function isLargePayload(payload: unknown): boolean {
  return JSON.stringify(payload).length > LARGE_JSON_BYTES;
}

/**
 * Print human digest to stdout. When the full payload is large, spill JSON to a
 * temp file and append the path so agents can read the complete result.
 */
export async function emitResult(
  digest: string,
  fullPayload: unknown,
  spillPrefix: string,
): Promise<void> {
  let text = digest;
  if (isLargePayload(fullPayload)) {
    const path = await writeJsonSpill(fullPayload, spillPrefix);
    text = `${digest}\n\nFull JSON written to: ${path}`;
  }
  process.stdout.write(`${text}\n`);
}

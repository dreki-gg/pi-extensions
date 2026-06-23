import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Writes the full (untruncated) ticket context to a temp file the agent can
 * read with the `read` tool, keeping the inline tool response compact.
 *
 * `prefix` controls the filename stem (e.g. "ticket" → `ticket-<ts>.md`).
 * Returns the absolute path to the written file.
 */
export async function writeContextFile(content: string, prefix = 'ticket'): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pi-jira-'));
  const path = join(dir, `${prefix}-${Date.now()}.md`);
  await writeFile(path, content, 'utf-8');
  return path;
}

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Writes the full (untruncated) search results to a temp file the agent can
 * read freely with the `read` tool, sidestepping the inline truncation that
 * hides long log messages and attributes.
 *
 * Returns the absolute path to the written file.
 */
export async function writeResultsFile(content: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pi-datadog-'));
  const path = join(dir, `logs-${Date.now()}.md`);
  await writeFile(path, content, 'utf-8');
  return path;
}

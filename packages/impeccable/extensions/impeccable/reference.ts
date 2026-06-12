import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// reference.ts ships at extensions/impeccable/; the playbooks ship at
// skills/impeccable/reference/ — both inside the package, so this relative
// path holds whether running from source or an installed copy.
const HERE = dirname(fileURLToPath(import.meta.url));
const REFERENCE_DIR = join(HERE, '..', '..', 'skills', 'impeccable', 'reference');

/** Read a command's reference playbook, or null when it does not exist. */
export async function loadReference(command: string): Promise<string | null> {
  try {
    return await readFile(join(REFERENCE_DIR, `${command}.md`), 'utf-8');
  } catch {
    return null;
  }
}

export { REFERENCE_DIR };

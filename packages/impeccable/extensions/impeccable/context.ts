import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// PRODUCT.md / DESIGN.md may live at the project root or under a couple of
// conventional context dirs (per the init playbook). We probe those locations
// rather than walking the whole tree.
const CONTEXT_DIRS = ['.', '.agents/context', 'docs'];

export interface ProjectContext {
  /** PRODUCT.md content, or null when the project has not been set up. */
  product: string | null;
  /** DESIGN.md content, or null when no visual spec exists yet. */
  design: string | null;
}

async function findDoc(cwd: string, names: string[]): Promise<string | null> {
  for (const dir of CONTEXT_DIRS) {
    for (const name of names) {
      try {
        return await readFile(join(cwd, dir, name), 'utf-8');
      } catch {
        // not here — keep probing
      }
    }
  }
  return null;
}

/** Load the project's design context. Cheap, read-only, never throws. */
export async function loadProjectContext(cwd: string): Promise<ProjectContext> {
  const [product, design] = await Promise.all([
    findDoc(cwd, ['PRODUCT.md', 'product.md']),
    findDoc(cwd, ['DESIGN.md', 'design.md']),
  ]);
  return { product, design };
}

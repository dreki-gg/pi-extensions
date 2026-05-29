/**
 * Plan disk I/O — exec-pending markers and handoff documents.
 */

import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import type { ExecPendingConfig } from '../types.js';
import { EXEC_PENDING_FILE } from '../constants.js';

export async function writeExecPending(dir: string, config: ExecPendingConfig): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/${EXEC_PENDING_FILE}`, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export async function readAndClearExecPending(): Promise<
  { planDir: string; config: ExecPendingConfig } | undefined
> {
  try {
    const entries = await readdir('.plans', { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = `.plans/${entry.name}`;
      const markerPath = `${dir}/${EXEC_PENDING_FILE}`;
      try {
        const text = await readFile(markerPath, 'utf-8');
        const config = JSON.parse(text) as ExecPendingConfig;
        await unlink(markerPath);
        return { planDir: dir, config };
      } catch {
        // No marker in this directory
      }
    }
  } catch {
    // .plans/ doesn't exist
  }
  return undefined;
}

export async function saveHandoff(planDir: string, content: string): Promise<void> {
  await mkdir(planDir, { recursive: true });
  await writeFile(`${planDir}/HANDOFF.md`, content, 'utf-8');
}

export async function loadHandoff(planDir: string): Promise<string | undefined> {
  try {
    return await readFile(`${planDir}/HANDOFF.md`, 'utf-8');
  } catch {
    return undefined;
  }
}

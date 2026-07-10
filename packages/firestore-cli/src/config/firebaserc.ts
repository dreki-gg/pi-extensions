import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function readFirebaseRcProjectId(cwd: string): string | null {
  try {
    const raw = readFileSync(join(cwd, '.firebaserc'), 'utf-8');
    const parsed = JSON.parse(raw) as { projects?: { default?: string } };
    return parsed?.projects?.default ?? null;
  } catch {
    return null;
  }
}

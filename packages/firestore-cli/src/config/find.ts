import { existsSync } from 'node:fs';
import { dirname, join, parse as parsePath, resolve } from 'node:path';

const PROJECT_CANDIDATES = [
  ['.agents', 'firestore.json'],
  ['.pi', 'firestore.json'],
  ['.pi', 'firebase.json'],
] as const;

/** Walk from startDir to filesystem root; return every candidate path tried (whether or not it exists). */
export function collectConfigCandidates(startDir: string): string[] {
  const candidates: string[] = [];
  let dir = resolve(startDir);
  const { root } = parsePath(dir);

  while (true) {
    for (const [folder, file] of PROJECT_CANDIDATES) {
      candidates.push(join(dir, folder, file));
    }
    if (dir === root) break;
    dir = dirname(dir);
  }

  return candidates;
}

/**
 * Find the first existing firestore config walking up from cwd.
 * Precedence per directory: `.agents/firestore.json` → `.pi/firestore.json` → `.pi/firebase.json`.
 */
export function findConfigPath(startDir: string): string | null {
  let dir = resolve(startDir);
  const { root } = parsePath(dir);

  while (true) {
    for (const [folder, file] of PROJECT_CANDIDATES) {
      const candidate = join(dir, folder, file);
      if (existsSync(candidate)) return candidate;
    }
    if (dir === root) return null;
    dir = dirname(dir);
  }
}

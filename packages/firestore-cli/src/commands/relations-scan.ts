import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { FirestoreProjectConfig } from '../config/types.js';

export interface CodebaseRef {
  collection: string;
  file: string;
}

const COLLECTION_PATTERNS = [
  /\.collection\(\s*['"`]([a-zA-Z_][\w-]*)['"`]\s*\)/g,
  /\.doc\(\s*['"`]([a-zA-Z_][\w-]*(?:\/[^'"`]+)*)['"`]\s*\)/g,
];

export function extractCollectionRefs(code: string, filePath: string): CodebaseRef[] {
  const refs: CodebaseRef[] = [];
  for (const pattern of COLLECTION_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(code)) !== null) {
      const value = match[1];
      if (value.includes('/')) {
        const segments = value.split('/');
        for (let i = 0; i < segments.length; i += 2) {
          refs.push({ collection: segments[i], file: filePath });
        }
      } else {
        refs.push({ collection: value, file: filePath });
      }
    }
  }
  return refs;
}

export async function scanCodebase(
  cwd: string,
  config: Pick<FirestoreProjectConfig, 'scanPaths' | 'scanExclude'>,
): Promise<CodebaseRef[]> {
  const allRefs: CodebaseRef[] = [];
  const extensions = ['ts', 'tsx', 'js', 'jsx'];

  for (const scanPath of config.scanPaths) {
    const basePath = join(cwd, scanPath);
    let files: string[];
    try {
      files = await readdir(basePath, { recursive: true });
    } catch {
      continue;
    }
    for (const file of files) {
      const ext = file.split('.').pop();
      if (!ext || !extensions.includes(ext)) continue;
      if (config.scanExclude.some((p) => file.includes(p) || file.startsWith(p))) continue;
      try {
        const content = await readFile(join(basePath, file), 'utf-8');
        allRefs.push(...extractCollectionRefs(content, join(scanPath, file)));
      } catch {
        // skip unreadable
      }
    }
  }
  return allRefs;
}

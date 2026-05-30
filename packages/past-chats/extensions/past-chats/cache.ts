import fs from 'node:fs';
import path from 'node:path';
import { Effect, Schema } from 'effect';
import { CACHE_FILE } from './config';
import { PastChatCacheSchema } from './schema';
import type { PastChatCache, PastChatCacheEntry } from './types';

function cachePath(cwd: string): string {
  return path.join(cwd, CACHE_FILE);
}

export function loadCache(cwd: string): PastChatCache {
  const filePath = cachePath(cwd);
  if (!fs.existsSync(filePath)) return { entries: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Effect.runSync(
      Schema.decodeUnknown(PastChatCacheSchema)(parsed).pipe(
        Effect.catchAll(() => Effect.succeed({ entries: [] })),
      ),
    );
  } catch (err) {
    console.warn(`[past-chats] Failed to parse ${CACHE_FILE}:`, err);
    return { entries: [] };
  }
}

export function saveCache(cwd: string, cache: PastChatCache): void {
  const filePath = cachePath(cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(cache, null, 2) + '\n', 'utf8');
}

export function findCacheEntry(
  cache: PastChatCache,
  key: Omit<PastChatCacheEntry, 'summary' | 'generatedAt'>,
): PastChatCacheEntry | undefined {
  return cache.entries.find(
    (entry) =>
      entry.path === key.path &&
      entry.modified === key.modified &&
      entry.version === key.version &&
      entry.provider === key.provider &&
      entry.model === key.model,
  );
}

export function upsertCacheEntry(cache: PastChatCache, entry: PastChatCacheEntry): PastChatCache {
  const entries = cache.entries.filter(
    (candidate) =>
      !(
        candidate.path === entry.path &&
        candidate.modified === entry.modified &&
        candidate.version === entry.version &&
        candidate.provider === entry.provider &&
        candidate.model === entry.model
      ),
  );
  entries.push(entry);
  return { entries };
}

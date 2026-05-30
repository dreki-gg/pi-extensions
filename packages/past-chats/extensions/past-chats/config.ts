import fs from 'node:fs';
import path from 'node:path';
import { Effect, Schema } from 'effect';
import { PastChatsConfigSchema } from './schema';
import type { PastChatsConfig, ResolvedPastChatFolder } from './types';

export const CONFIG_FILE = '.pi/past-chats.json';
export const CACHE_FILE = '.pi/past-chats-cache.json';

const DEFAULT_CONFIG: PastChatsConfig = { folders: [] };

export function normalizeConfig(value: unknown): PastChatsConfig {
  return Effect.runSync(
    Schema.decodeUnknown(PastChatsConfigSchema)(value).pipe(
      Effect.map((config) => ({
        ...config,
        folders: config.folders.flatMap((folder): PastChatsConfig['folders'] => {
          const folderPath = folder.path.trim();
          if (!folderPath) return [];
          const label = folder.label?.trim();
          return [{ path: folderPath, ...(label ? { label } : {}) }];
        }),
      })),
      Effect.catchAll(() => Effect.succeed({ ...DEFAULT_CONFIG })),
    ),
  );
}

export function loadConfig(cwd: string): PastChatsConfig {
  const filePath = path.join(cwd, CONFIG_FILE);
  if (!fs.existsSync(filePath)) return { ...DEFAULT_CONFIG };

  try {
    return normalizeConfig(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch (err) {
    console.warn(`[past-chats] Failed to parse ${CONFIG_FILE}:`, err);
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(cwd: string, config: PastChatsConfig): void {
  const filePath = path.join(cwd, CONFIG_FILE);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(normalizeConfig(config), null, 2) + '\n', 'utf8');
}

export function resolveFolders(cwd: string, config: PastChatsConfig): ResolvedPastChatFolder[] {
  const seen = new Set<string>();
  return config.folders.flatMap((folder) => {
    const resolved = path.resolve(cwd, folder.path);
    if (seen.has(resolved)) return [];
    seen.add(resolved);
    return [
      {
        path: resolved,
        label: folder.label?.trim() || path.basename(resolved) || resolved,
        exists: fs.existsSync(resolved),
      },
    ];
  });
}

export function addFolder(config: PastChatsConfig, folderPath: string, label?: string): PastChatsConfig {
  const normalizedLabel = label?.trim();
  const folders = config.folders.filter((folder) => folder.path !== folderPath && folder.label !== normalizedLabel);
  folders.push({ path: folderPath, ...(normalizedLabel ? { label: normalizedLabel } : {}) });
  return { ...config, folders };
}

export function removeFolder(config: PastChatsConfig, target: string): PastChatsConfig {
  const normalized = target.trim();
  return {
    ...config,
    folders: config.folders.filter((folder) => folder.path !== normalized && folder.label !== normalized),
  };
}

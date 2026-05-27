import fs from 'node:fs';
import path from 'node:path';
import type { ContextFoldersConfig, ResolvedFolder } from './types';

export const CONFIG_FILE = '.pi/context-folders.json';

export function loadConfig(cwd: string): ContextFoldersConfig {
  const filePath = path.join(cwd, CONFIG_FILE);
  if (!fs.existsSync(filePath)) {
    return { folders: [] };
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as ContextFoldersConfig;
  } catch (err) {
    console.warn(`[context-folders] Failed to parse ${CONFIG_FILE}:`, err);
    return { folders: [] };
  }
}

export function saveConfig(cwd: string, config: ContextFoldersConfig): void {
  const filePath = path.join(cwd, CONFIG_FILE);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export function resolveFolders(cwd: string, config: ContextFoldersConfig): ResolvedFolder[] {
  return config.folders.map((folder) => {
    const resolved = path.resolve(cwd, folder.path);
    return {
      path: resolved,
      label: folder.label || path.basename(resolved),
      exists: fs.existsSync(resolved),
    };
  });
}

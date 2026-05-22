import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReviewConfig } from './types';

const CONFIG_FILE = '.code-review.json';
const DEFAULT_LENS_DIR = '.code-review/lenses';

export function loadConfig(cwd: string): ReviewConfig {
  const configPath = resolve(cwd, CONFIG_FILE);

  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ReviewConfig>;
      return {
        lensDir: parsed.lensDir ?? DEFAULT_LENS_DIR,
        defaultLenses: parsed.defaultLenses ?? [],
      };
    } catch {
      // Malformed config — fall back to defaults
    }
  }

  return {
    lensDir: DEFAULT_LENS_DIR,
    defaultLenses: [],
  };
}

export function getLensDir(cwd: string, config: ReviewConfig): string {
  return resolve(cwd, config.lensDir);
}

export function getConfigPath(cwd: string): string {
  return resolve(cwd, CONFIG_FILE);
}

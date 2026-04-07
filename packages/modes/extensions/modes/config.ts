import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAgentDir } from '@mariozechner/pi-coding-agent';

export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export interface PresetDefinition {
  description?: string;
  provider?: string;
  model?: string;
  thinkingLevel?: ThinkingLevel;
  tools?: string[];
  instructions?: string;
  aliases?: string[];
}

export type PresetsConfig = Record<string, PresetDefinition>;

export interface LoadedPresets {
  presets: PresetsConfig;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizePreset(value: unknown): PresetDefinition | null {
  if (!isRecord(value)) return null;

  const preset: PresetDefinition = {};

  if (typeof value.description === 'string' && value.description.trim()) {
    preset.description = value.description.trim();
  }
  if (typeof value.provider === 'string' && value.provider.trim()) {
    preset.provider = value.provider.trim();
  }
  if (typeof value.model === 'string' && value.model.trim()) {
    preset.model = value.model.trim();
  }
  if (typeof value.thinkingLevel === 'string' && value.thinkingLevel.trim()) {
    preset.thinkingLevel = value.thinkingLevel as ThinkingLevel;
  }
  const tools = normalizeStringArray(value.tools);
  if (tools) preset.tools = tools;

  if (typeof value.instructions === 'string' && value.instructions.trim()) {
    preset.instructions = value.instructions.trim();
  }

  const aliases = normalizeStringArray(value.aliases);
  if (aliases) preset.aliases = aliases;

  return preset;
}

function parsePresetFile(path: string, errors: string[]): PresetsConfig {
  if (!existsSync(path)) return {};

  try {
    const content = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(content) as unknown;
    if (!isRecord(parsed)) {
      errors.push(`${path}: expected a JSON object at the top level.`);
      return {};
    }

    const presets: PresetsConfig = {};
    for (const [name, value] of Object.entries(parsed)) {
      const normalized = normalizePreset(value);
      if (!normalized) {
        errors.push(`${path}: preset "${name}" must be a JSON object.`);
        continue;
      }
      presets[name] = normalized;
    }
    return presets;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`${path}: ${message}`);
    return {};
  }
}

function mergePresets(base: PresetsConfig, override: PresetsConfig): PresetsConfig {
  const merged: PresetsConfig = { ...base };
  for (const [name, preset] of Object.entries(override)) {
    merged[name] = {
      ...(merged[name] ?? {}),
      ...preset,
    };
  }
  return merged;
}

export function getGlobalPresetsPath(): string {
  const override = process.env.PI_MODES_GLOBAL_PRESETS_PATH?.trim();
  if (override) return override;
  return join(getAgentDir(), 'presets.json');
}

export function getProjectPresetsPath(cwd: string): string {
  return join(cwd, '.pi', 'presets.json');
}

export function loadPresets(cwd: string): LoadedPresets {
  const errors: string[] = [];
  const globalPath = getGlobalPresetsPath();
  const projectPath = getProjectPresetsPath(cwd);

  const globalPresets = parsePresetFile(globalPath, errors);
  const projectPresets = parsePresetFile(projectPath, errors);

  return {
    presets: mergePresets(globalPresets, projectPresets),
    errors,
  };
}

export function getPresetAliases(name: string, preset: PresetDefinition): string[] {
  const aliases = new Set<string>();

  for (const alias of [name, ...(preset.aliases ?? [])]) {
    const normalized = alias.trim();
    if (normalized) aliases.add(normalized);
  }

  return [...aliases];
}

function escapeRegex(text: string): string {
  return text.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function wildcardToRegex(pattern: string): RegExp {
  const source = `^${pattern.split('*').map(escapeRegex).join('.*')}$`;
  return new RegExp(source);
}

export function resolveToolPatterns(patterns: string[], allToolNames: string[]) {
  const resolved: string[] = [];
  const unmatched: string[] = [];

  for (const pattern of patterns) {
    const matcher = pattern.includes('*') ? wildcardToRegex(pattern) : null;
    const matches = matcher
      ? allToolNames.filter((toolName) => matcher.test(toolName))
      : allToolNames.filter((toolName) => toolName === pattern);

    if (matches.length === 0) {
      unmatched.push(pattern);
      continue;
    }

    for (const match of matches) {
      if (!resolved.includes(match)) resolved.push(match);
    }
  }

  return { resolved, unmatched };
}

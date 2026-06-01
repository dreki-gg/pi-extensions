/**
 * Plan mode configuration — load and merge user config with defaults.
 *
 * Config resolution order:
 *   1. Project-level: .plans/plan-mode-config.json
 *   2. Global-level: ~/.pi/agent/plan-mode-config.json
 *   3. Built-in defaults (constants.ts)
 */

import type { ThinkingLevel } from './types.js';
import {
  PLAN_MODEL,
  PLAN_THINKING,
  EXEC_MODEL,
  EXEC_THINKING,
  EXEC_MODEL_OPTIONS,
} from './constants.js';

export interface ModelPreset {
  provider: string;
  id: string;
}

export interface ModelOption {
  label: string;
  model: ModelPreset;
}

export interface PlanModeConfig {
  planModel: ModelPreset;
  planThinking: ThinkingLevel;
  execModel: ModelPreset;
  execThinking: ThinkingLevel;
  execModelOptions: ModelOption[];
}

/**
 * Get the default configuration from constants.
 */
export function getDefaultConfig(): PlanModeConfig {
  return {
    planModel: PLAN_MODEL,
    planThinking: PLAN_THINKING,
    execModel: EXEC_MODEL,
    execThinking: EXEC_THINKING,
    execModelOptions: [...EXEC_MODEL_OPTIONS],
  };
}

/**
 * Validate a model preset object.
 */
function isValidModelPreset(obj: unknown): obj is ModelPreset {
  if (!obj || typeof obj !== 'object') return false;
  const preset = obj as Record<string, unknown>;
  return typeof preset.provider === 'string' && typeof preset.id === 'string';
}

/**
 * Validate a thinking level string.
 */
function isValidThinkingLevel(value: unknown): value is ThinkingLevel {
  const validLevels: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'];
  return typeof value === 'string' && validLevels.includes(value as ThinkingLevel);
}

/**
 * Validate a model option object.
 */
function isValidModelOption(obj: unknown): obj is ModelOption {
  if (!obj || typeof obj !== 'object') return false;
  const option = obj as Record<string, unknown>;
  return typeof option.label === 'string' && isValidModelPreset(option.model);
}

/**
 * Parse and validate a raw config object, returning only valid fields.
 */
function parseConfig(raw: Record<string, unknown>): Partial<PlanModeConfig> {
  const config: Partial<PlanModeConfig> = {};

  if (isValidModelPreset(raw.planModel)) {
    config.planModel = raw.planModel;
  }
  if (isValidThinkingLevel(raw.planThinking)) {
    config.planThinking = raw.planThinking;
  }
  if (isValidModelPreset(raw.execModel)) {
    config.execModel = raw.execModel;
  }
  if (isValidThinkingLevel(raw.execThinking)) {
    config.execThinking = raw.execThinking;
  }
  if (Array.isArray(raw.execModelOptions) && raw.execModelOptions.every(isValidModelOption)) {
    config.execModelOptions = raw.execModelOptions;
  }

  return config;
}

/**
 * Merge partial config with defaults.
 */
function mergeConfig(partial: Partial<PlanModeConfig>, defaults: PlanModeConfig): PlanModeConfig {
  return {
    planModel: partial.planModel ?? defaults.planModel,
    planThinking: partial.planThinking ?? defaults.planThinking,
    execModel: partial.execModel ?? defaults.execModel,
    execThinking: partial.execThinking ?? defaults.execThinking,
    execModelOptions: partial.execModelOptions ?? defaults.execModelOptions,
  };
}

/**
 * Load configuration from a JSON file path.
 * Returns null if file doesn't exist or is invalid.
 */
async function loadConfigFile(filePath: string): Promise<Partial<PlanModeConfig> | null> {
  try {
    // Use dynamic import for fs to work in both Node.js and Bun
    const fs = await import('fs/promises');
    const content = await fs.readFile(filePath, 'utf-8');
    const raw = JSON.parse(content);
    if (typeof raw !== 'object' || raw === null) return null;
    return parseConfig(raw as Record<string, unknown>);
  } catch {
    // File doesn't exist or is invalid JSON
    return null;
  }
}

/**
 * Get the global config file path (~/.pi/agent/plan-mode-config.json).
 */
function getGlobalConfigPath(): string {
  const os = require('os');
  const path = require('path');
  return path.join(os.homedir(), '.pi', 'agent', 'plan-mode-config.json');
}

/**
 * Load configuration with priority:
 *   1. Project-level (.plans/plan-mode-config.json)
 *   2. Global-level (~/.pi/agent/plan-mode-config.json)
 *   3. Built-in defaults
 *
 * Project config is merged with global config, which is merged with defaults.
 */
export async function loadConfig(projectDir?: string): Promise<PlanModeConfig> {
  const defaults = getDefaultConfig();

  // Try loading global config
  const globalPath = getGlobalConfigPath();
  const globalConfig = await loadConfigFile(globalPath);

  // Try loading project config
  let projectConfig: Partial<PlanModeConfig> | null = null;
  if (projectDir) {
    const path = require('path');
    const projectPath = path.join(projectDir, '.plans', 'plan-mode-config.json');
    projectConfig = await loadConfigFile(projectPath);
  }

  // Merge: project > global > defaults
  const merged = mergeConfig(projectConfig ?? {}, mergeConfig(globalConfig ?? {}, defaults));
  return merged;
}

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ExtensionAPI, ExtensionContext } from '@mariozechner/pi-coding-agent';
import {
  getGlobalPresetsPath,
  getPresetAliases,
  loadPresets,
  resolveToolPatterns,
  type PresetDefinition,
  type PresetsConfig,
} from './config';
import { DEFAULT_GLOBAL_PRESETS } from './defaults';

interface ModeState {
  name: string | null;
}

interface BeforeAgentStartCompatEvent {
  systemPromptOptions?: {
    selectedTools?: string[];
  };
}

const STATE_ENTRY = 'modes-state';
const DEFAULT_CLEAR_VALUES = new Set(['', 'off', 'none', 'clear', 'disable']);

function listPresetNames(presets: PresetsConfig): string[] {
  return Object.keys(presets).sort();
}

function findSavedPresetName(ctx: ExtensionContext): string | null | undefined {
  const branchEntries = ctx.sessionManager.getBranch?.() ?? ctx.sessionManager.getEntries?.() ?? [];
  let lastValue: string | null | undefined;

  for (const entry of branchEntries) {
    if (entry.type !== 'custom' || entry.customType !== STATE_ENTRY) continue;
    const data = entry.data as ModeState | undefined;
    if (typeof data?.name === 'string' || data?.name === null) {
      lastValue = data.name;
    }
  }

  return lastValue;
}

function buildPresetSummary(
  name: string,
  preset: PresetDefinition,
  activePresetName?: string,
): string {
  const parts: string[] = [];
  if (preset.description) parts.push(preset.description);
  if (preset.tools?.length) parts.push(`tools:${preset.tools.join(',')}`);
  if (preset.provider && preset.model) parts.push(`${preset.provider}/${preset.model}`);
  if (preset.thinkingLevel) parts.push(`thinking:${preset.thinkingLevel}`);

  const prefix = name === activePresetName ? '* ' : '  ';
  return `${prefix}${name}${parts.length > 0 ? ` — ${parts.join(' | ')}` : ''}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function ensureGlobalPresetDefaults() {
  const path = getGlobalPresetsPath();
  const names = Object.keys(DEFAULT_GLOBAL_PRESETS);

  if (!existsSync(path)) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(DEFAULT_GLOBAL_PRESETS, null, 2)}\n`, 'utf8');
    return { created: true, added: names, path };
  }

  const content = await readFile(path, 'utf8');
  const parsed = JSON.parse(content) as unknown;
  if (!isRecord(parsed)) {
    return {
      created: false,
      added: [],
      path,
      error: 'expected a JSON object at the top level; skipping default preset bootstrap.',
    };
  }

  let changed = false;
  const next = { ...parsed };
  const added: string[] = [];

  for (const [name, preset] of Object.entries(DEFAULT_GLOBAL_PRESETS)) {
    if (name in next) continue;
    next[name] = preset;
    added.push(name);
    changed = true;
  }

  if (changed) {
    await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  }

  return { created: false, added, path };
}

export default function modesExtension(pi: ExtensionAPI) {
  let presets: PresetsConfig = {};
  let activePresetName: string | undefined;
  let activePreset: PresetDefinition | undefined;
  let defaultActiveTools: string[] = [];

  pi.registerFlag('preset', {
    description: 'Preset/mode configuration to use',
    type: 'string',
  });

  function refreshDefaultTools() {
    if (defaultActiveTools.length > 0) return;
    defaultActiveTools = [...pi.getActiveTools()];
  }

  function reloadPresets(cwd: string, ctx?: ExtensionContext) {
    const loaded = loadPresets(cwd);
    presets = loaded.presets;

    if (ctx) {
      for (const error of loaded.errors) {
        ctx.ui.notify(`pi-modes: ${error}`, 'warning');
      }
    }
  }

  function updateStatus(ctx: ExtensionContext) {
    if (activePresetName) {
      ctx.ui.setStatus('mode', `mode:${activePresetName}`);
    } else {
      ctx.ui.setStatus('mode', undefined);
    }
  }

  function persistState() {
    pi.appendEntry<ModeState>(STATE_ENTRY, { name: activePresetName ?? null });
  }

  async function clearPreset(
    ctx: ExtensionContext,
    options: { notify?: boolean; persist?: boolean } = {},
  ): Promise<void> {
    refreshDefaultTools();
    pi.setActiveTools([...defaultActiveTools]);
    activePresetName = undefined;
    activePreset = undefined;
    updateStatus(ctx);

    if (options.persist !== false) persistState();
    if (options.notify !== false)
      ctx.ui.notify('Preset cleared. Default tool access restored.', 'info');
  }

  async function applyPreset(
    name: string,
    preset: PresetDefinition,
    ctx: ExtensionContext,
    options: { notify?: boolean; persist?: boolean } = {},
  ): Promise<boolean> {
    refreshDefaultTools();

    if (preset.provider && preset.model) {
      const modelRegistry = ctx.modelRegistry;
      const model = modelRegistry?.find?.(preset.provider, preset.model);

      if (model) {
        const success = await pi.setModel(model);
        if (!success) {
          ctx.ui.notify(
            `Preset "${name}": No API key for ${preset.provider}/${preset.model}`,
            'warning',
          );
        }
      } else {
        ctx.ui.notify(
          `Preset "${name}": Model ${preset.provider}/${preset.model} not found`,
          'warning',
        );
      }
    }

    if (preset.thinkingLevel) {
      pi.setThinkingLevel(preset.thinkingLevel);
    }

    if (preset.tools) {
      const allToolNames = pi.getAllTools().map((tool) => tool.name);
      const { resolved, unmatched } = resolveToolPatterns(preset.tools, allToolNames);

      if (unmatched.length > 0) {
        ctx.ui.notify(
          `Preset "${name}": Unknown tools/patterns: ${unmatched.join(', ')}`,
          'warning',
        );
      }

      if (resolved.length === 0 && preset.tools.length > 0) {
        ctx.ui.notify(`Preset "${name}": No matching tools found. Preset not applied.`, 'error');
        return false;
      }

      pi.setActiveTools(resolved);
    }

    activePresetName = name;
    activePreset = preset;
    updateStatus(ctx);

    if (options.persist !== false) persistState();
    if (options.notify !== false) ctx.ui.notify(`Preset "${name}" activated`, 'info');
    return true;
  }

  async function restorePresetState(ctx: ExtensionContext): Promise<void> {
    const savedName = findSavedPresetName(ctx);

    if (savedName === null) {
      await clearPreset(ctx, { notify: false, persist: false });
      return;
    }

    if (!savedName) {
      updateStatus(ctx);
      return;
    }

    const preset = presets[savedName];
    if (!preset) {
      ctx.ui.notify(
        `Saved preset "${savedName}" is no longer defined. Clearing active preset.`,
        'warning',
      );
      await clearPreset(ctx, { notify: false, persist: false });
      return;
    }

    await applyPreset(savedName, preset, ctx, { notify: false, persist: false });
  }

  function isAliasReserved(alias: string): boolean {
    const commands = pi.getCommands?.() ?? [];
    return commands.some((command) => {
      if (command.name !== alias) return false;
      if (command.source !== 'extension') return true;
      return !['preset', 'mode', 'modes'].includes(command.name);
    });
  }

  function getPresetForAlias(alias: string): string | undefined {
    if (isAliasReserved(alias)) return undefined;

    for (const [name, preset] of Object.entries(presets)) {
      if (getPresetAliases(name, preset).includes(alias)) return name;
    }
    return undefined;
  }

  async function showPresetSelector(ctx: ExtensionContext): Promise<void> {
    const names = listPresetNames(presets);
    if (names.length === 0) {
      ctx.ui.notify(
        'No presets defined. Add presets to ~/.pi/agent/presets.json or .pi/presets.json',
        'warning',
      );
      return;
    }

    if (!ctx.hasUI) {
      const lines = [
        'Available presets:',
        ...names.map((name) => buildPresetSummary(name, presets[name], activePresetName)),
      ];
      ctx.ui.notify(lines.join('\n'), 'info');
      return;
    }

    const choice = await ctx.ui.select(`Select preset (active: ${activePresetName ?? 'none'})`, [
      '(none)',
      ...names,
    ]);
    if (!choice) return;

    if (choice === '(none)') {
      await clearPreset(ctx);
      return;
    }

    const preset = presets[choice];
    if (!preset) return;
    await applyPreset(choice, preset, ctx);
  }

  async function handlePresetCommand(
    args: string | undefined,
    ctx: ExtensionContext,
  ): Promise<void> {
    reloadPresets(ctx.cwd, ctx);

    const raw = args?.trim() ?? '';
    if (!raw || raw === 'list') {
      await showPresetSelector(ctx);
      return;
    }

    if (DEFAULT_CLEAR_VALUES.has(raw.toLowerCase())) {
      await clearPreset(ctx);
      return;
    }

    const preset = presets[raw];
    if (!preset) {
      const available = listPresetNames(presets).join(', ') || '(none defined)';
      ctx.ui.notify(`Unknown preset "${raw}". Available: ${available}`, 'error');
      return;
    }

    await applyPreset(raw, preset, ctx);
  }

  pi.registerCommand('preset', {
    description: 'Apply, select, or clear a preset/mode',
    handler: async (args, ctx) => {
      await handlePresetCommand(args, ctx);
    },
  });

  pi.registerCommand('mode', {
    description: 'Alias of /preset',
    handler: async (args, ctx) => {
      await handlePresetCommand(args, ctx);
    },
  });

  pi.registerCommand('modes', {
    description: 'List available presets/modes',
    handler: async (_args, ctx) => {
      reloadPresets(ctx.cwd, ctx);
      const names = listPresetNames(presets);
      if (names.length === 0) {
        ctx.ui.notify(
          'No presets defined. Add presets to ~/.pi/agent/presets.json or .pi/presets.json',
          'warning',
        );
        return;
      }

      const lines = [
        'Available presets:',
        ...names.map((name) => buildPresetSummary(name, presets[name], activePresetName)),
      ];
      if (activePresetName) lines.push('', `Active preset: ${activePresetName}`);
      ctx.ui.notify(lines.join('\n'), 'info');
    },
  });

  pi.on('input', async (event) => {
    if (event.source === 'extension') return { action: 'continue' } as const;

    const trimmed = event.text.trim();
    if (!trimmed.startsWith('/')) return { action: 'continue' } as const;

    const body = trimmed.slice(1);
    if (!body || body.includes(' ')) return { action: 'continue' } as const;

    const presetName = getPresetForAlias(body);
    if (!presetName) return { action: 'continue' } as const;

    return { action: 'transform', text: `/preset ${presetName}` } as const;
  });

  pi.on('before_agent_start', async (event) => {
    if (!activePresetName) return;

    const preset = activePreset ?? presets[activePresetName];
    if (!preset) return;

    const compatEvent = event as typeof event & BeforeAgentStartCompatEvent;
    const activeTools = compatEvent.systemPromptOptions?.selectedTools ?? pi.getActiveTools();
    const instructions = preset.instructions?.trim();
    const sections = [
      `Current mode: ${activePresetName}`,
      `Enabled tools: ${activeTools.length > 0 ? activeTools.join(', ') : '(none)'}`,
      instructions,
    ].filter((section): section is string => Boolean(section));

    return {
      systemPrompt: `${event.systemPrompt}\n\n${sections.join('\n\n')}`,
    };
  });

  pi.on('session_start', async (_event, ctx) => {
    try {
      const bootstrap = await ensureGlobalPresetDefaults();
      if (bootstrap.error) {
        ctx.ui.notify(`pi-modes: ${bootstrap.error} (${bootstrap.path})`, 'warning');
      } else if (bootstrap.created) {
        ctx.ui.notify(
          `pi-modes: created starter global presets at ${bootstrap.path} (${bootstrap.added.join(', ')})`,
          'info',
        );
      } else if (bootstrap.added.length > 0) {
        ctx.ui.notify(
          `pi-modes: added starter presets to ${bootstrap.path}: ${bootstrap.added.join(', ')}`,
          'info',
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`pi-modes: failed to bootstrap global presets: ${message}`, 'warning');
    }

    reloadPresets(ctx.cwd, ctx);
    refreshDefaultTools();

    const presetFlag = pi.getFlag('preset');
    if (typeof presetFlag === 'string' && presetFlag.trim()) {
      const name = presetFlag.trim();

      if (DEFAULT_CLEAR_VALUES.has(name.toLowerCase())) {
        await clearPreset(ctx, { notify: false });
      } else {
        const preset = presets[name];

        if (preset) {
          await applyPreset(name, preset, ctx, { notify: false });
        } else {
          const available = listPresetNames(presets).join(', ') || '(none defined)';
          ctx.ui.notify(`Unknown preset "${name}". Available: ${available}`, 'warning');
        }
      }
    } else {
      await restorePresetState(ctx);
    }

    updateStatus(ctx);
  });

  pi.on('session_tree', async (_event, ctx) => {
    reloadPresets(ctx.cwd, ctx);
    await restorePresetState(ctx);
    updateStatus(ctx);
  });
}

/**
 * /plan-config command — Interactive model configuration for plan mode.
 */

import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import type { PlanModeConfig, ModelPreset, ModelOption } from '../config.js';
import { getDefaultConfig } from '../config.js';

const COMMON_MODELS: ModelOption[] = [
  { label: 'claude-opus-4-6', model: { provider: 'anthropic', id: 'claude-opus-4-6' } },
  { label: 'claude-sonnet-4-6', model: { provider: 'anthropic', id: 'claude-sonnet-4-6' } },
  { label: 'gpt-5.5', model: { provider: 'openai', id: 'gpt-5.5' } },
  { label: 'gpt-5', model: { provider: 'openai', id: 'gpt-5' } },
  { label: 'gemini-2.5-pro', model: { provider: 'google', id: 'gemini-2.5-pro' } },
  { label: 'gemini-2.5-flash', model: { provider: 'google', id: 'gemini-2.5-flash' } },
];

const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const;

interface ConfigFileScope {
  name: string;
  path: string;
}

/**
 * Format a model preset for display.
 */
function formatModel(model: ModelPreset): string {
  return `${model.provider}/${model.id}`;
}

/**
 * Display current configuration.
 */
function showConfig(config: PlanModeConfig): string {
  const lines = [
    '**Current Plan Mode Configuration**',
    '',
    `| Setting | Value |`,
    `|---------|-------|`,
    `| Planning Model | ${formatModel(config.planModel)} |`,
    `| Planning Thinking | ${config.planThinking} |`,
    `| Execution Model | ${formatModel(config.execModel)} |`,
    `| Execution Thinking | ${config.execThinking} |`,
    '',
    '**Execution Model Options:**',
    ...config.execModelOptions.map((o) => `- ${o.label} (${formatModel(o.model)})`),
  ];
  return lines.join('\n');
}

/**
 * Parse a model string like "anthropic/claude-sonnet-4-6" into a ModelPreset.
 */
function parseModelString(input: string): ModelPreset | null {
  const parts = input.trim().split('/');
  if (parts.length !== 2) return null;
  return { provider: parts[0], id: parts[1] };
}

/**
 * Register the /plan-config command.
 */
export function registerPlanConfigCommand(
  pi: any, // ExtensionAPI
  getConfig: () => Promise<PlanModeConfig>,
  saveConfig: (config: Partial<PlanModeConfig>, scope: 'project' | 'global') => Promise<void>,
): void {
  pi.registerCommand('plan-config', {
    description: 'Configure plan mode models interactively. Use: /plan-config [show|plan-model|exec-model|thinking|options|save]',
    handler: async (args: string | undefined, ctx: ExtensionCommandContext) => {
      const trimmed = args?.trim().toLowerCase();
      const config = await getConfig();

      // Show current config
      if (!trimmed || trimmed === 'show') {
        ctx.ui.notify(showConfig(config), 'info');
        return;
      }

      // Configure planning model
      if (trimmed === 'plan-model') {
        const choice = await ctx.ui.select('Select planning model:', [
          ...COMMON_MODELS.map((o) => `${o.label} (${formatModel(o.model)})`),
          'Custom (enter manually)',
        ]);

        if (!choice) return;

        let model: ModelPreset | null = null;

        if (choice === 'Custom (enter manually)') {
          const input = await ctx.ui.editor('Enter model (format: provider/model-id):', formatModel(config.planModel));
          if (input) model = parseModelString(input);
        } else {
          const selected = COMMON_MODELS.find((o) => choice.startsWith(o.label));
          if (selected) model = selected.model;
        }

        if (model) {
          await saveConfig({ planModel: model }, 'project');
          ctx.ui.notify(`Planning model set to ${formatModel(model)}`, 'info');
        }
        return;
      }

      // Configure execution model
      if (trimmed === 'exec-model') {
        const choice = await ctx.ui.select('Select default execution model:', [
          ...COMMON_MODELS.map((o) => `${o.label} (${formatModel(o.model)})`),
          'Custom (enter manually)',
        ]);

        if (!choice) return;

        let model: ModelPreset | null = null;

        if (choice === 'Custom (enter manually)') {
          const input = await ctx.ui.editor('Enter model (format: provider/model-id):', formatModel(config.execModel));
          if (input) model = parseModelString(input);
        } else {
          const selected = COMMON_MODELS.find((o) => choice.startsWith(o.label));
          if (selected) model = selected.model;
        }

        if (model) {
          await saveConfig({ execModel: model }, 'project');
          ctx.ui.notify(`Execution model set to ${formatModel(model)}`, 'info');
        }
        return;
      }

      // Configure thinking levels
      if (trimmed === 'thinking') {
        const target = await ctx.ui.select('Configure thinking for:', ['Planning', 'Execution', 'Both']);
        if (!target) return;

        if (target === 'Planning' || target === 'Both') {
          const thinking = await ctx.ui.select('Planning thinking level:', [...THINKING_LEVELS]);
          if (thinking) {
            const updates: Partial<PlanModeConfig> = { planThinking: thinking as PlanModeConfig['planThinking'] };
            if (target === 'Both') {
              const execThinking = await ctx.ui.select('Execution thinking level:', [...THINKING_LEVELS]);
              if (execThinking) updates.execThinking = execThinking as PlanModeConfig['execThinking'];
            }
            await saveConfig(updates, 'project');
            ctx.ui.notify('Thinking levels updated', 'info');
          }
        } else {
          const thinking = await ctx.ui.select('Execution thinking level:', [...THINKING_LEVELS]);
          if (thinking) {
            await saveConfig({ execThinking: thinking as PlanModeConfig['execThinking'] }, 'project');
            ctx.ui.notify('Execution thinking level updated', 'info');
          }
        }
        return;
      }

      // Configure execution model options
      if (trimmed === 'options') {
        const action = await ctx.ui.select('Manage execution model options:', [
          'View current options',
          'Add model option',
          'Remove model option',
          'Reset to defaults',
        ]);

        if (!action) return;

        if (action === 'View current options') {
          const list = config.execModelOptions
            .map((o, i) => `${i + 1}. ${o.label} — ${formatModel(o.model)}`)
            .join('\n');
          ctx.ui.notify(`Execution Model Options:\n${list}`, 'info');
          return;
        }

        if (action === 'Add model option') {
          const label = await ctx.ui.editor('Label for this option:', '');
          if (!label) return;

          const modelStr = await ctx.ui.editor('Model (format: provider/model-id):', '');
          if (!modelStr) return;

          const model = parseModelString(modelStr);
          if (!model) {
            ctx.ui.notify('Invalid format. Use: provider/model-id', 'error');
            return;
          }

          const newOptions = [...config.execModelOptions, { label, model }];
          await saveConfig({ execModelOptions: newOptions }, 'project');
          ctx.ui.notify(`Added option: ${label}`, 'info');
          return;
        }

        if (action === 'Remove model option') {
          if (config.execModelOptions.length <= 1) {
            ctx.ui.notify('Must keep at least one option', 'error');
            return;
          }

          const labels = config.execModelOptions.map((o) => `${o.label} (${formatModel(o.model)})`);
          const choice = await ctx.ui.select('Remove which option?', labels);
          if (!choice) return;

          const idx = labels.indexOf(choice);
          if (idx >= 0) {
            const newOptions = config.execModelOptions.filter((_, i) => i !== idx);
            await saveConfig({ execModelOptions: newOptions }, 'project');
            ctx.ui.notify('Option removed', 'info');
          }
          return;
        }

        if (action === 'Reset to defaults') {
          const defaults = getDefaultConfig();
          await saveConfig({ execModelOptions: defaults.execModelOptions }, 'project');
          ctx.ui.notify('Options reset to defaults', 'info');
        }
        return;
      }

      // Save config to specific scope
      if (trimmed === 'save') {
        const scope = await ctx.ui.select('Save configuration to:', ['Project (.plans/plan-mode-config.json)', 'Global (~/.pi/agent/plan-mode-config.json)']);
        if (!scope) return;

        const target = scope.startsWith('Project') ? 'project' : 'global';
        await saveConfig(config, target);
        ctx.ui.notify(`Configuration saved to ${target}`, 'info');
        return;
      }

      // Help
      ctx.ui.notify(
        [
          '**Plan Config Commands**',
          '',
          '`/plan-config` or `/plan-config show` — Show current configuration',
          '`/plan-config plan-model` — Set planning model',
          '`/plan-config exec-model` — Set execution model',
          '`/plan-config thinking` — Configure thinking levels',
          '`/plan-config options` — Manage execution model options',
          '`/plan-config save` — Save config to file',
        ].join('\n'),
        'info',
      );
    },
  });
}

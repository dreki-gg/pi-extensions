/**
 * Plan mode constants — tool sets, model presets, thinking levels, and execution model options.
 */

// ── Tool sets ────────────────────────────────────────────────────────────────
export const PLAN_TOOLS = [
  'read',
  'bash',
  'grep',
  'find',
  'ls',
  'submit_plan',
  'questionnaire',
  'search_skills',
];

export const EXEC_TOOLS = ['read', 'bash', 'edit', 'write', 'update_step'];

// ── Model + thinking presets ─────────────────────────────────────────────────
export const PLAN_MODEL = { provider: 'anthropic', id: 'claude-opus-4-6' } as const;
export const PLAN_THINKING = 'medium' as const;

export const EXEC_MODEL = { provider: 'openai', id: 'gpt-5.5' } as const;
export const EXEC_THINKING = 'low' as const;

// ── Exec-pending marker file name ────────────────────────────────────────────
export const EXEC_PENDING_FILE = '.exec-pending.json';

// ── Execution model picker options ───────────────────────────────────────────
export const EXEC_MODEL_OPTIONS: { label: string; model: { provider: string; id: string } }[] = [
  { label: 'gpt-5.5', model: { provider: 'openai', id: 'gpt-5.5' } },
  { label: 'claude-opus-4-6', model: { provider: 'anthropic', id: 'claude-opus-4-6' } },
];

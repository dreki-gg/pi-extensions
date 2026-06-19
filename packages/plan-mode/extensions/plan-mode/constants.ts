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
  'submit_initiative',
  'revise_plan',
  'preview_prototype',
  'write',
  'questionnaire',
  'search_skills',
  'subagent',
  'plan_status',
  'set_active_plan',
  'update_plan',
  'update_initiative',
  'initiative_status',
  'reconcile_plans',
];

export const EXEC_TOOLS = [
  'read',
  'bash',
  'edit',
  'write',
  'update_task',
  'update_tasks',
  'add_task',
  'plan_status',
  'set_active_plan',
  'update_plan',
  'update_initiative',
  'initiative_status',
  'reconcile_plans',
];

// ── Exec-pending marker file name ────────────────────────────────────────────
export const EXEC_PENDING_FILE = '.exec-pending.json';

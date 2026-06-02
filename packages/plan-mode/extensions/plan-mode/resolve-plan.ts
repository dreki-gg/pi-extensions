/**
 * Disk-backed active-plan resolution.
 *
 * `state.plan` is session-scoped: it is only populated when a plan is submitted
 * in *this* session, restored from this session's entries, or handed off via
 * the one-shot exec-pending file. But `.plans/<name>/tasks.jsonl` is the real
 * source of truth, and execution routinely happens in a different session than
 * planning. This bridges that gap: when nothing is attached in memory, resolve
 * the plan from disk so `update_task` / `add_task` work without an interactive
 * `/plan resume`.
 *
 * Attaching only loads the plan DATA into `state` (so tracking writes land in
 * `tasks.jsonl`); it intentionally does NOT flip `executing` / tools / model —
 * that stays the user's explicit choice via `/plan-exec` or `/plan resume`.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { PlanModeState } from './state.js';
import type { PlanData } from './types.js';
import type { RunPlanIO } from './effects/runtime.js';
import { readPlansManifest } from './storage/plans-manifest.js';
import { readTasksJsonl } from './storage/task-storage.js';
import { loadHandoff } from './storage/plan-storage.js';

export interface ResolvedPlan {
  /** The attached plan, when resolvable. Already written into `state`. */
  plan?: PlanData;
  /**
   * In-progress plan names, surfaced when resolution was ambiguous (multiple
   * in-progress and no usable `name` hint) or a hint missed. Lets a caller
   * report actionable choices instead of dead-ending.
   */
  candidates: string[];
}

/** Normalize a plan hint (`my-plan` or `.plans/my-plan`) to a bare name. */
function normalizeName(hint: string): string {
  return hint
    .replace(/^\.plans\//, '')
    .replace(/\/+$/, '')
    .trim();
}

/** Load `.plans/<name>` from disk into `state` (data only). Returns the plan,
 *  or undefined when the tasks file is missing/empty. */
async function attach(
  state: PlanModeState,
  pi: ExtensionAPI,
  runPlanIO: RunPlanIO,
  name: string,
): Promise<PlanData | undefined> {
  const dir = `.plans/${name}`;
  const snapshot = await runPlanIO(readTasksJsonl(dir));
  if (!snapshot) return undefined;
  const plan: PlanData = {
    title: snapshot.meta.title,
    planName: snapshot.meta.plan_name,
    handoff: (await runPlanIO(loadHandoff(dir))) ?? '',
    tasks: snapshot.tasks,
  };
  state.plan = plan;
  state.planDir = dir;
  state.persist(pi);
  return plan;
}

/**
 * Resolve the active plan, attaching from disk when nothing is in memory.
 *
 * Order: in-memory `state.plan` → explicit `name` hint → the single
 * in-progress plan in `.plans/plans.jsonl`. Ambiguous (multiple in-progress,
 * no hint) returns `{ plan: undefined, candidates }` so the caller can prompt
 * for a `name`.
 */
export async function resolveActivePlan(
  state: PlanModeState,
  pi: ExtensionAPI,
  runPlanIO: RunPlanIO,
  opts: { name?: string } = {},
): Promise<ResolvedPlan> {
  if (state.plan) return { plan: state.plan, candidates: [] };

  const manifest = await runPlanIO(readPlansManifest());

  if (opts.name) {
    const hint = normalizeName(opts.name);
    const match = manifest.find((entry) => entry.name === hint);
    // A hint that names a real plan attaches regardless of status (the caller
    // asked for it explicitly); a hint that names nothing falls through to the
    // ambiguity report so the caller sees the valid choices.
    if (match) {
      const plan = await attach(state, pi, runPlanIO, match.name);
      if (plan) return { plan, candidates: [] };
    }
  }

  const inProgress = manifest.filter((entry) => entry.status === 'in-progress');
  if (inProgress.length === 1) {
    const plan = await attach(state, pi, runPlanIO, inProgress[0]!.name);
    if (plan) return { plan, candidates: [] };
  }

  return { plan: undefined, candidates: inProgress.map((entry) => entry.name) };
}

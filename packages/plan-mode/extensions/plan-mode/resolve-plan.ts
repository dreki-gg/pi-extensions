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
import type { RunPlanIO } from '@dreki-gg/taskman';
import { readPlansManifest } from '@dreki-gg/taskman';
import { readTasksJsonl } from '@dreki-gg/taskman';
import { loadHandoff } from '@dreki-gg/taskman';

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
    base_commit: snapshot.meta.base_commit,
  };
  state.plan = plan;
  state.planDir = dir;
  state.persist(pi);
  return plan;
}

/**
 * Resolve the active plan, attaching from disk when nothing is in memory.
 *
 * Order: explicit `name` hint → in-memory `state.plan` → the single
 * in-progress plan in `.plans/plans.jsonl`. Ambiguous (multiple in-progress,
 * no hint) returns `{ plan: undefined, candidates }` so the caller can prompt
 * for a `name`.
 *
 * IMPORTANT (FEEDBACK #7): an explicit `name` hint ALWAYS wins over the
 * in-memory `state.plan`. Previously `state.plan` short-circuited first, so a
 * deliberate `{ plan: '<other>' }` was silently ignored and writes landed in
 * whatever plan the last `submit_plan` attached — a data-corruption path. The
 * hint is now resolved first; when it names a different plan we re-attach from
 * disk so subsequent writes target the right `tasks.jsonl`.
 */
export async function resolveActivePlan(
  state: PlanModeState,
  pi: ExtensionAPI,
  runPlanIO: RunPlanIO,
  opts: { name?: string } = {},
): Promise<ResolvedPlan> {
  // ── Explicit hint wins, even over an attached in-memory plan ──────────────
  if (opts.name) {
    const hint = normalizeName(opts.name);
    // Already the attached plan? Return the in-memory copy (freshest task state).
    if (state.plan && state.plan.planName === hint) return { plan: state.plan, candidates: [] };

    const manifest = await runPlanIO(readPlansManifest());
    const match = manifest.find((entry) => entry.name === hint);
    // A hint that names a real plan attaches regardless of status (the caller
    // asked for it explicitly); a hint that names nothing falls through to the
    // ambiguity report so the caller sees the valid choices.
    if (match) {
      const plan = await attach(state, pi, runPlanIO, match.name);
      if (plan) return { plan, candidates: [] };
    }
    const inProgress = manifest.filter((entry) => entry.status === 'in-progress');
    return { plan: undefined, candidates: inProgress.map((entry) => entry.name) };
  }

  // ── No hint: in-memory plan, else the single in-progress plan on disk ─────
  if (state.plan) return { plan: state.plan, candidates: [] };

  const manifest = await runPlanIO(readPlansManifest());
  const inProgress = manifest.filter((entry) => entry.status === 'in-progress');
  if (inProgress.length === 1) {
    const plan = await attach(state, pi, runPlanIO, inProgress[0]!.name);
    if (plan) return { plan, candidates: [] };
  }

  return { plan: undefined, candidates: inProgress.map((entry) => entry.name) };
}

/**
 * Pin a plan as the active one (the tool/command form of `/plan focus`).
 *
 * Clears any stale in-memory plan first so the hint always re-attaches from
 * disk, then resolves by name. Returns the same `ResolvedPlan` shape so callers
 * can report success or surface in-progress candidates on a miss.
 */
export async function focusActivePlan(
  state: PlanModeState,
  pi: ExtensionAPI,
  runPlanIO: RunPlanIO,
  name: string,
): Promise<ResolvedPlan> {
  state.plan = undefined;
  state.planDir = undefined;
  return resolveActivePlan(state, pi, runPlanIO, { name });
}

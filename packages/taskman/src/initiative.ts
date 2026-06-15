/**
 * Initiative logic — ready-work computation and the initiative→plan projection.
 *
 * Two layers live here:
 *   - PURE: `computePlanReadiness`, `isInitiativeFinalizable`, `initiativeRollup`
 *     reason over a plans-manifest snapshot with no IO. They are the basis for
 *     "what work is unblocked right now" — the foundation for phase-2 subagent
 *     fan-out.
 *   - IO: `reconcileInitiativeStatus` / `reconcileInitiativeForPlan` keep an
 *     initiative's registry status a PROJECTION of its member plans, mirroring
 *     `reconcilePlanStatus` one level up. They read the PLANS manifest, so they
 *     live here (not in `initiatives-manifest.ts`) to keep the dependency
 *     direction one-way: initiative.ts → {plans-manifest, initiatives-manifest}.
 */

import { Effect } from 'effect';
import { FileSystem } from './effects/filesystem.js';
import type { JsonlParseError, JsonlValidationError, PlanWriteError } from './errors.js';
import { readPlansManifest, type PlanManifestEntry } from './storage/plans-manifest.js';
import {
  applyInitiativeUpsert,
  mutateInitiativesManifest,
} from './storage/initiatives-manifest.js';
import type { PlanStatus } from './types.js';

// ── Pure: readiness + projection rules ───────────────────────────────────────

export interface PlanReadiness {
  name: string;
  /** True when every plan in `depends_on` is `done`. */
  ready: boolean;
  /** Dependency plan names that are not yet `done` (unknown deps count too). */
  blockedBy: string[];
}

/**
 * For each `in-progress` plan, whether all of its plan-level dependencies are
 * `done`. Only a `done` dependency unblocks — a missing, in-progress, or
 * terminally-closed (superseded/abandoned) dependency keeps a plan blocked.
 */
export function computePlanReadiness(plans: readonly PlanManifestEntry[]): PlanReadiness[] {
  const statusByName = new Map(plans.map((plan) => [plan.name, plan.status]));
  return plans
    .filter((plan) => plan.status === 'in-progress')
    .map((plan) => {
      const deps = plan.depends_on ?? [];
      const blockedBy = deps.filter((dep) => statusByName.get(dep) !== 'done');
      return { name: plan.name, ready: blockedBy.length === 0, blockedBy };
    });
}

/** Member plans of an initiative (linked by name in the plans manifest). */
export function membersOf(
  initiative: string,
  plans: readonly PlanManifestEntry[],
): PlanManifestEntry[] {
  return plans.filter((plan) => plan.initiative === initiative);
}

/**
 * An initiative is finalizable (`done`) when it has ≥1 member plan AND every
 * member is terminal (no member is `in-progress`). Mirrors the plan-level rule
 * one level up.
 */
export function isInitiativeFinalizable(
  initiative: string,
  plans: readonly PlanManifestEntry[],
): boolean {
  const members = membersOf(initiative, plans);
  if (members.length === 0) return false;
  return members.every((plan) => plan.status !== 'in-progress');
}

export interface InitiativeMemberRow {
  name: string;
  title: string;
  status: PlanStatus;
  /** Present for in-progress members. */
  ready?: boolean;
  blockedBy?: string[];
}

export interface InitiativeRollup {
  name: string;
  total: number;
  done: number;
  /** Terminal but not done (superseded / abandoned). */
  closed: number;
  inProgress: number;
  ready: number;
  blocked: number;
  members: InitiativeMemberRow[];
}

/** Aggregate an initiative's member plans into counts + per-member readiness. */
export function initiativeRollup(
  initiative: string,
  plans: readonly PlanManifestEntry[],
): InitiativeRollup {
  const members = membersOf(initiative, plans);
  const readiness = new Map(computePlanReadiness(plans).map((row) => [row.name, row]));

  let done = 0;
  let closed = 0;
  let inProgress = 0;
  let ready = 0;
  let blocked = 0;

  const rows: InitiativeMemberRow[] = members.map((plan) => {
    if (plan.status === 'done') done += 1;
    else if (plan.status === 'in-progress') inProgress += 1;
    else closed += 1; // superseded / abandoned

    const row: InitiativeMemberRow = { name: plan.name, title: plan.title, status: plan.status };
    if (plan.status === 'in-progress') {
      const r = readiness.get(plan.name);
      row.ready = r?.ready ?? true;
      row.blockedBy = r?.blockedBy ?? [];
      if (row.ready) ready += 1;
      else blocked += 1;
    }
    return row;
  });

  return {
    name: initiative,
    total: members.length,
    done,
    closed,
    inProgress,
    ready,
    blocked,
    members: rows,
  };
}

// ── IO: keep initiative registry status a projection of member plans ─────────

type ReconcileError = JsonlParseError | JsonlValidationError | PlanWriteError;

/**
 * Re-derive an initiative's registry status from its member plans.
 *
 * Like `reconcilePlanStatus`: only reflects state for a KNOWN initiative (never
 * conjures an entry), and never clobbers a manually-set terminal status
 * (`superseded` / `abandoned`). Only `in-progress` ⇄ `done` is derived.
 */
export function reconcileInitiativeStatus(
  name: string,
): Effect.Effect<void, ReconcileError, FileSystem> {
  // The whole read-decide-write runs under the initiatives lock so a concurrent
  // writer cannot slip a status change between our read and our write.
  return mutateInitiativesManifest((initiatives) =>
    Effect.gen(function* () {
      const existing = initiatives.find((entry) => entry.name === name);
      if (!existing) return false;
      if (existing.status === 'superseded' || existing.status === 'abandoned') return false;
      const plans = yield* readPlansManifest();
      const status: PlanStatus = isInitiativeFinalizable(name, plans) ? 'done' : 'in-progress';
      if (existing.status === status) return false;
      applyInitiativeUpsert(initiatives, name, { status, title: existing.title });
      return true;
    }),
  );
}

/**
 * Reconcile the initiative that a given plan belongs to (no-op when the plan is
 * standalone). Call this after any plan-status write so the initiative level
 * stays in sync without callers needing to know the parent name.
 */
export function reconcileInitiativeForPlan(
  planName: string,
): Effect.Effect<void, ReconcileError, FileSystem> {
  return Effect.gen(function* () {
    const plans = yield* readPlansManifest();
    const plan = plans.find((entry) => entry.name === planName);
    if (!plan?.initiative) return;
    yield* reconcileInitiativeStatus(plan.initiative);
  });
}

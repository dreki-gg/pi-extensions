/**
 * Sync orchestrator: the routine maintenance entry point.
 *
 * previewSync infers the current stacks, reconciles with stored state, and
 * reports pending repairs without mutating anything. applySync snapshots first
 * (refreshing lastKnownTip), then performs squash-merge repairs and refreshes
 * PR description blocks, persisting state as it goes. Any failure rolls back via
 * the undo journal inside the repair layer.
 */
import type { ExecFn } from '../cli/runner';
import { renderStackBlock, upsertStackBlock } from './description';
import { defaultTrunk } from './git';
import { listOpenPrs, setPrBody, viewPr } from './gh';
import { inferStacks } from './inference';
import { reconcile } from './reconcile';
import { detectMerged, repairAfterMerge } from './repair';
import { loadState, saveState } from './state';
import { snapshot } from './undo';
import type { Stack, StackState } from './types';

export interface SyncPreview {
  trunk: string;
  state: StackState;
  /** Per-stack merged-but-deleted branches needing repair. */
  repairs: Array<{ stackIndex: number; branches: string[] }>;
  summary: string;
}

/** Infer + reconcile + report pending work without mutating. */
export async function previewSync(exec: ExecFn): Promise<SyncPreview> {
  const trunk = await defaultTrunk(exec);
  const stored = await loadState(exec);
  const prs = await listOpenPrs(exec);
  const inferred = inferStacks(prs, trunk);
  const state = reconcile(stored, inferred);

  const repairs: SyncPreview['repairs'] = [];
  for (let i = 0; i < state.stacks.length; i++) {
    const merged = await detectMerged(exec, state.stacks[i]!);
    if (merged.length > 0) {
      repairs.push({ stackIndex: i, branches: merged.map((m) => m.branch) });
    }
  }

  return { trunk, state, repairs, summary: renderSummary(state.stacks, repairs) };
}

function renderSummary(stacks: Stack[], repairs: SyncPreview['repairs']): string {
  if (stacks.length === 0) return 'No stacks detected.';
  const lines: string[] = [];
  stacks.forEach((stack, i) => {
    const chain = stack.entries
      .map((e) => (e.prNumber ? `${e.branch} #${e.prNumber}` : e.branch))
      .join(' → ');
    lines.push(`Stack ${i + 1}: ${stack.trunk} → ${chain}`);
  });
  if (repairs.length > 0) {
    lines.push('');
    lines.push('Pending repairs (merged + deleted):');
    for (const r of repairs) lines.push(`  • stack ${r.stackIndex + 1}: ${r.branches.join(', ')}`);
  } else {
    lines.push('');
    lines.push('No repairs needed.');
  }
  return lines.join('\n');
}

export interface SyncResult {
  ok: boolean;
  actions: string[];
  error?: string;
}

/** Snapshot, repair merged branches, refresh description blocks, persist state. */
export async function applySync(exec: ExecFn): Promise<SyncResult> {
  const preview = await previewSync(exec);
  const actions: string[] = [];
  let state = preview.state;

  // Snapshot first so lastKnownTip is fresh before any mutation.
  const { journal, tips } = await snapshot(exec, state.stacks);
  state = {
    version: state.version,
    stacks: state.stacks.map((s) => ({
      trunk: s.trunk,
      entries: s.entries.map((e) => {
        const tip = tips.get(e.branch);
        return tip ? { ...e, lastKnownTip: tip } : e;
      }),
    })),
  };

  // Repair each stack's merged+deleted entries (bottom-up).
  for (let i = 0; i < state.stacks.length; i++) {
    let stack = state.stacks[i]!;
    const merged = await detectMerged(exec, stack);
    for (const entry of merged) {
      const repair = await repairAfterMerge(exec, stack, entry, journal);
      if (!repair.ok) {
        await saveState(exec, state);
        return { ok: false, actions, error: repair.error };
      }
      stack = repair.stack;
      actions.push(...repair.actions);
    }
    state.stacks[i] = stack;
  }

  // Refresh PR description blocks.
  for (const stack of state.stacks) {
    for (const entry of stack.entries) {
      if (entry.prNumber === undefined) continue;
      const pr = await viewPr(exec, entry.prNumber);
      if (!pr) continue;
      const block = renderStackBlock(stack, entry.branch);
      const newBody = upsertStackBlock(pr.body ?? '', block);
      if (newBody !== (pr.body ?? '')) {
        const ok = await setPrBody(exec, entry.prNumber, newBody);
        if (ok) actions.push(`updated #${entry.prNumber} stack block`);
      }
    }
  }

  await saveState(exec, state);
  return { ok: true, actions };
}

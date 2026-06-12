import type { ExtensionAPI, ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import type { ExecFn, ExecResult } from './cli/runner';
import { detectGitHub } from './cli/detect';
import { renderStack } from './stack/render';
import { changedFiles, changedLineCount, currentTrunk } from './stack/git';
import { proposeSplit, renderProposal, shouldRecommendSplit } from './split/analyzer';
import { executeSteps, planExecution } from './split/executor';
import { previewSync, applySync } from './engine/sync';
import { previewMerge, mergeRoot } from './engine/merge';
import { defaultTrunk } from './engine/git';
import { listOpenPrs } from './engine/gh';
import { inferStacks } from './engine/inference';
import { reconcile } from './engine/reconcile';
import { loadState } from './engine/state';
import { loadJournal, restore } from './engine/undo';
import type { StackNode } from './stack/parser';
import type { Stack } from './engine/types';

const STATUS_KEY = 'stacked-prs';
const USAGE = 'Usage: /stack status | split | sync | merge | undo';

/** Convert engine Stack chains into the StackNode forest the renderer expects. */
function stacksToNodes(stacks: Stack[]): StackNode[] {
  return stacks.map((stack) => {
    let child: StackNode | undefined;
    for (let i = stack.entries.length - 1; i >= 0; i--) {
      const entry = stack.entries[i]!;
      const node: StackNode = {
        branch: entry.branch,
        number: entry.prNumber,
        provider: entry.prNumber !== undefined ? 'github' : undefined,
        depth: 0,
        children: child ? [child] : [],
      };
      child = node;
    }
    return {
      branch: stack.trunk,
      depth: 0,
      children: child ? [child] : [],
    } satisfies StackNode;
  });
}

export function registerStackedPrsCommands(pi: ExtensionAPI) {
  const exec: ExecFn = (command, args) => pi.exec(command, args) as Promise<ExecResult>;

  async function ensureReady(ctx: ExtensionCommandContext): Promise<boolean> {
    ctx.ui.setStatus(STATUS_KEY, '🔍 Checking GitHub CLI...');
    const detect = await detectGitHub(exec);
    ctx.ui.setStatus(STATUS_KEY, undefined);
    if (!detect.ready) {
      ctx.ui.notify(detect.message ?? 'GitHub CLI unavailable.', 'error');
      return false;
    }
    return true;
  }

  async function handleStatus(ctx: ExtensionCommandContext) {
    if (!(await ensureReady(ctx))) return;
    ctx.ui.setStatus(STATUS_KEY, '📊 Reading stacks...');
    const trunk = await defaultTrunk(exec);
    const stored = await loadState(exec);
    const prs = await listOpenPrs(exec);
    const state = reconcile(stored, inferStacks(prs, trunk));
    ctx.ui.setStatus(STATUS_KEY, undefined);
    ctx.ui.notify(renderStack(stacksToNodes(state.stacks)), 'info');
  }

  async function handleSync(ctx: ExtensionCommandContext) {
    if (!(await ensureReady(ctx))) return;
    ctx.ui.setStatus(STATUS_KEY, '🔎 Previewing sync...');
    const preview = await previewSync(exec);
    ctx.ui.setStatus(STATUS_KEY, undefined);
    ctx.ui.notify(preview.summary, 'info');

    if (preview.state.stacks.length === 0) return;
    const apply = await ctx.ui.confirm(
      'Apply stack sync?',
      'Snapshot, repair merged branches, and refresh PR stack blocks?',
    );
    if (!apply) {
      ctx.ui.notify('Sync cancelled.', 'info');
      return;
    }
    ctx.ui.setStatus(STATUS_KEY, '⚙️ Applying sync...');
    const result = await applySync(exec);
    ctx.ui.setStatus(STATUS_KEY, undefined);
    if (!result.ok) {
      ctx.ui.notify(`Sync failed (rolled back):\n${result.error}`, 'error');
      return;
    }
    ctx.ui.notify(
      result.actions.length > 0 ? result.actions.join('\n') : 'Sync applied; nothing to change.',
      'info',
    );
  }

  async function handleMerge(ctx: ExtensionCommandContext) {
    if (!(await ensureReady(ctx))) return;
    ctx.ui.setStatus(STATUS_KEY, '🔎 Reading stack...');
    const trunk = await defaultTrunk(exec);
    const stored = await loadState(exec);
    const prs = await listOpenPrs(exec);
    const state = reconcile(stored, inferStacks(prs, trunk));
    ctx.ui.setStatus(STATUS_KEY, undefined);

    const stack = state.stacks[0];
    if (!stack || stack.entries.length === 0) {
      ctx.ui.notify('No stack to merge.', 'warning');
      return;
    }
    const plan = previewMerge(stack);
    ctx.ui.notify(
      `Would merge root ${plan.rootBranch}${plan.rootPr ? ` #${plan.rootPr}` : ''} via ${plan.method}, then repair: ${
        plan.descendantBranches.join(', ') || '(none)'
      }`,
      'info',
    );
    const apply = await ctx.ui.confirm(
      'Merge root PR?',
      `Merge ${plan.rootBranch} and repair ${plan.descendantBranches.length} descendant(s)?`,
    );
    if (!apply) {
      ctx.ui.notify('Merge cancelled.', 'info');
      return;
    }
    ctx.ui.setStatus(STATUS_KEY, '⚙️ Merging...');
    const result = await mergeRoot(exec, stack);
    ctx.ui.setStatus(STATUS_KEY, undefined);
    if (!result.ok) {
      ctx.ui.notify(`Merge failed:\n${result.error}`, 'error');
      return;
    }
    ctx.ui.notify(result.actions.join('\n'), 'info');
  }

  async function handleUndo(ctx: ExtensionCommandContext) {
    if (!(await ensureReady(ctx))) return;
    const journal = await loadJournal(exec);
    if (!journal) {
      ctx.ui.notify('No undo journal found — nothing to restore.', 'warning');
      return;
    }
    const branches = Object.keys(journal.tips);
    const bases = Object.keys(journal.bases);
    ctx.ui.notify(
      `Undo would restore ${branches.length} branch tip(s) and ${bases.length} PR base(s) from ${journal.takenAt}.`,
      'info',
    );
    const apply = await ctx.ui.confirm('Apply undo?', 'Restore branch tips and PR bases?');
    if (!apply) {
      ctx.ui.notify('Undo cancelled.', 'info');
      return;
    }
    ctx.ui.setStatus(STATUS_KEY, '↩️ Restoring...');
    const result = await restore(exec, journal);
    ctx.ui.setStatus(STATUS_KEY, undefined);
    const msg = [...result.actions, ...result.errors].join('\n') || 'Nothing to restore.';
    ctx.ui.notify(msg, result.ok ? 'info' : 'error');
  }

  async function handleSplit(ctx: ExtensionCommandContext) {
    if (!(await ensureReady(ctx))) return;

    ctx.ui.setStatus(STATUS_KEY, '🔬 Analyzing changes...');
    const files = await changedFiles(exec);
    const lines = await changedLineCount(exec);
    const trunk = await currentTrunk(exec);
    ctx.ui.setStatus(STATUS_KEY, undefined);

    if (files.length === 0) {
      ctx.ui.notify('No uncommitted changes to split.', 'warning');
      return;
    }

    const layers = proposeSplit(files);
    const rec = shouldRecommendSplit(files, lines);
    ctx.ui.notify(
      [
        rec.recommend ? '✅ Stacking recommended.' : 'ℹ️ Stacking optional.',
        rec.reason,
        '',
        `Trunk: ${trunk}`,
        '',
        renderProposal(layers),
      ].join('\n'),
      'info',
    );

    if (layers.length < 2) {
      ctx.ui.notify('Only one layer detected — a single PR is simpler.', 'warning');
      return;
    }

    const confirmed = await ctx.ui.confirm(
      'Execute this split?',
      `Create ${layers.length} chained branches off ${trunk}, commit + push each, and open a PR per layer?`,
    );
    if (!confirmed) {
      ctx.ui.notify('Split cancelled. No branches created.', 'info');
      return;
    }

    const steps = planExecution(layers, { trunk });
    ctx.ui.setStatus(STATUS_KEY, '🏗️ Building stack...');
    const result = await executeSteps(exec, steps);
    if (!result.ok) {
      ctx.ui.setStatus(STATUS_KEY, undefined);
      ctx.ui.notify(
        `${result.error}\n\nRan ${result.ranSteps}/${steps.length} steps. Inspect with \`git status\`; run /stack undo to roll back if needed.`,
        'error',
      );
      return;
    }

    // Record the stack and refresh PR description blocks.
    ctx.ui.setStatus(STATUS_KEY, '🔗 Recording stack...');
    const sync = await applySync(exec);
    ctx.ui.setStatus(STATUS_KEY, undefined);
    if (!sync.ok) {
      ctx.ui.notify(`Branches created, but recording the stack failed:\n${sync.error}`, 'warning');
      return;
    }
    ctx.ui.notify('Stack created and recorded. Run /stack status to view it.', 'info');
  }

  pi.registerCommand('stack', {
    description: `Manage stacked PRs. ${USAGE}`,
    handler: async (args, ctx) => {
      const sub = (args?.trim() || '').split(/\s+/)[0] || '';
      switch (sub) {
        case 'status':
          return handleStatus(ctx);
        case 'split':
          return handleSplit(ctx);
        case 'sync':
          return handleSync(ctx);
        case 'merge':
          return handleMerge(ctx);
        case 'undo':
          return handleUndo(ctx);
        default:
          ctx.ui.notify(USAGE, 'warning');
      }
    },
  });
}

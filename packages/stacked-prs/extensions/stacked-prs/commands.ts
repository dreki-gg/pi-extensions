import type { ExtensionAPI, ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import type { ExecFn, ExecResult } from './cli/runner';
import { runStack } from './cli/runner';
import { detectStack } from './cli/detect';
import { parseStackTree } from './stack/parser';
import { renderStack } from './stack/render';
import { changedFiles, changedLineCount, currentTrunk } from './stack/git';
import { proposeSplit, renderProposal, shouldRecommendSplit } from './split/analyzer';
import { executeSteps, planExecution } from './split/executor';

const STATUS_KEY = 'stacked-prs';
const USAGE = 'Usage: /stack status | split | sync | merge';

export function registerStackedPrsCommands(pi: ExtensionAPI) {
  const exec: ExecFn = (command, args) => pi.exec(command, args) as Promise<ExecResult>;

  /** Ensure the toolchain is ready; notify and return false otherwise. */
  async function ensureReady(ctx: ExtensionCommandContext): Promise<boolean> {
    ctx.ui.setStatus(STATUS_KEY, '🔍 Checking stack CLI...');
    const detect = await detectStack(exec);
    ctx.ui.setStatus(STATUS_KEY, undefined);
    if (!detect.stackInstalled || !detect.hostAuthenticated) {
      ctx.ui.notify(detect.message ?? 'Stacking toolchain unavailable.', 'error');
      return false;
    }
    return true;
  }

  /** Run a stack subcommand, surfacing failures. Returns stdout or null. */
  async function stackCmd(
    ctx: ExtensionCommandContext,
    args: string[],
    statusText: string,
  ): Promise<string | null> {
    ctx.ui.setStatus(STATUS_KEY, statusText);
    const res = await runStack(exec, args);
    ctx.ui.setStatus(STATUS_KEY, undefined);
    if (res.code !== 0) {
      const detail = res.stderr.trim() || res.stdout.trim() || `exit ${res.code}`;
      ctx.ui.notify(`stack ${args.join(' ')} failed:\n${detail}`, 'error');
      return null;
    }
    return res.stdout;
  }

  async function handleStatus(ctx: ExtensionCommandContext) {
    if (!(await ensureReady(ctx))) return;
    const out = await stackCmd(ctx, ['status'], '📊 Reading stack...');
    if (out === null) return;
    const tree = renderStack(parseStackTree(out));
    ctx.ui.notify(tree, 'info');
  }

  /** Preview-then-apply guarded wrapper used by sync and merge. */
  async function handleGuarded(ctx: ExtensionCommandContext, verb: 'sync' | 'merge') {
    if (!(await ensureReady(ctx))) return;
    const preview = await stackCmd(ctx, [verb], `🔎 Previewing ${verb}...`);
    if (preview === null) return;

    ctx.ui.notify(preview.trim() || `(no ${verb} preview output)`, 'info');
    const apply = await ctx.ui.confirm(
      `Apply stack ${verb}?`,
      `Run \`stack ${verb} --apply\` based on the preview above?`,
    );
    if (!apply) {
      ctx.ui.notify(`Stack ${verb} cancelled.`, 'info');
      return;
    }
    const result = await stackCmd(ctx, [verb, '--apply'], `⚙️ Applying ${verb}...`);
    if (result === null) return;
    ctx.ui.notify(result.trim() || `Stack ${verb} applied.`, 'info');
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
    const summary = [
      rec.recommend ? '✅ Stacking recommended.' : 'ℹ️ Stacking optional.',
      rec.reason,
      '',
      `Trunk: ${trunk}`,
      '',
      renderProposal(layers),
    ].join('\n');
    ctx.ui.notify(summary, 'info');

    if (layers.length < 2) {
      ctx.ui.notify('Only one layer detected — a single PR is simpler.', 'warning');
      return;
    }

    const confirmed = await ctx.ui.confirm(
      'Execute this split?',
      `Create ${layers.length} chained branches off ${trunk}, commit each layer, then run \`stack sync --apply\`?`,
    );
    if (!confirmed) {
      ctx.ui.notify('Split cancelled. No branches created.', 'info');
      return;
    }

    const steps = planExecution(layers, { trunk });
    ctx.ui.setStatus(STATUS_KEY, '🏗️ Building stack...');
    const result = await executeSteps(exec, steps);
    ctx.ui.setStatus(STATUS_KEY, undefined);

    if (!result.ok) {
      ctx.ui.notify(
        `${result.error}\n\nRan ${result.ranSteps}/${steps.length} steps. Inspect with \`git status\`; undo stack changes with \`/stack\` → stack undo if needed.`,
        'error',
      );
      return;
    }
    ctx.ui.notify('Stack created and published. Run /stack status to view it.', 'info');
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
          return handleGuarded(ctx, 'sync');
        case 'merge':
          return handleGuarded(ctx, 'merge');
        default:
          ctx.ui.notify(USAGE, 'warning');
      }
    },
  });
}

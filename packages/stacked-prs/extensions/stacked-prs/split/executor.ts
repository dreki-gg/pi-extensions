/**
 * Execute a confirmed split: create a branch per layer, stage that layer's
 * files, commit, and chain each layer onto the previous one.
 *
 * We build the branch chain with plain git, push each branch, and open a PR per
 * layer against its parent (root against trunk) via `gh pr create`. The engine's
 * `applySync` then records the stack and refreshes PR description blocks.
 */
import type { ExecFn } from '../cli/runner';
import type { ProposedLayer } from './analyzer';

export interface ExecuteOptions {
  /** Trunk branch the bottom layer stacks onto (e.g. "main"). */
  trunk: string;
  /** Prefix applied to each layer branch (e.g. "feat/"). */
  branchPrefix?: string;
}

export interface ExecuteStep {
  description: string;
  command: string;
  args: string[];
}

/** Build the ordered git steps for a split without running them (dry-run). */
export function planExecution(layers: ProposedLayer[], opts: ExecuteOptions): ExecuteStep[] {
  const steps: ExecuteStep[] = [];
  const prefix = opts.branchPrefix ?? '';
  let parent = opts.trunk;

  for (const layer of layers) {
    const branch = `${prefix}${layer.branch}`;
    steps.push({
      description: `Create ${branch} off ${parent}`,
      command: 'git',
      args: ['checkout', '-b', branch, parent],
    });
    for (const file of layer.files) {
      steps.push({
        description: `Stage ${file}`,
        command: 'git',
        args: ['add', '--', file],
      });
    }
    steps.push({
      description: `Commit ${layer.title}`,
      command: 'git',
      args: ['commit', '-m', layer.title],
    });
    steps.push({
      description: `Push ${branch}`,
      command: 'git',
      args: ['push', '--set-upstream', 'origin', branch],
    });
    steps.push({
      description: `Open PR for ${branch} -> ${parent}`,
      command: 'gh',
      args: [
        'pr',
        'create',
        '--head',
        branch,
        '--base',
        parent,
        '--title',
        layer.title,
        '--body',
        layer.rationale,
      ],
    });
    parent = branch;
  }

  return steps;
}

/** Run the planned steps in order, aborting on the first failure. */
export async function executeSteps(
  exec: ExecFn,
  steps: ExecuteStep[],
): Promise<{ ok: boolean; ranSteps: number; error?: string }> {
  let ran = 0;
  for (const step of steps) {
    const result = await exec(step.command, step.args);
    if (result.code !== 0) {
      const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.code}`;
      return {
        ok: false,
        ranSteps: ran,
        error: `Step failed: ${step.description}\n${detail}`,
      };
    }
    ran += 1;
  }
  return { ok: true, ranSteps: ran };
}

/**
 * Execute a confirmed split: create a branch per layer, stage that layer's
 * files, commit, and chain each layer onto the previous one.
 *
 * This intentionally uses plain git (the stack CLI's "agent happy path"): we
 * build the branch chain, then `stack sync --apply` infers and records the
 * stack and opens/retargets PRs. We do NOT open PRs ourselves to avoid
 * duplicating the stack CLI's provider logic.
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
    parent = branch;
  }

  steps.push({
    description: 'Infer, record, and publish the stack',
    command: 'stack',
    args: ['sync', '--apply'],
  });

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

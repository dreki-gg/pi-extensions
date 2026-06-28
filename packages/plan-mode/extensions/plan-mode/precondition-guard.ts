/**
 * Deterministic precondition guard for submit_plan.
 *
 * Catches "destructive premise without proof" drift at plan-submission time:
 * a task that deletes/removes/renames a codebase symbol/path but carries no
 * re-runnable consumer-proof command (or an explicit, auditable opt-out).
 *
 * Pure string heuristics — NO LLM, no reviewer agent, no I/O. The trigger is
 * intentionally narrow (destructive verb AND a codebase-scoped target) to
 * avoid false-positive fatigue, which is the failure mode that makes guards
 * get ignored.
 */

/** A destructive action verb applied to code. */
const DESTRUCTIVE =
  /\b(delete|deletes|deleting|remove|removes|removing|rename|renames|renaming|drop|drops|dropping|strip|strips|stripping|purge|purges|purging|deprecate|deprecates|deprecating|unregister|unregisters)\b|\b(rip|tear)\s+out\b/i;

/**
 * A codebase-scoped target: a backticked identifier, a file path, a known code
 * file extension, or a code-construct noun. Generic words like "file" alone are
 * deliberately excluded — file-ish targets must show up as a path/extension/
 * backtick — to keep "delete the temp file" from tripping the guard.
 */
const CODEBASE_TARGET =
  /`[^`]+`|\b[\w.-]+\/[\w./-]+|\.(ts|tsx|js|jsx|mjs|cjs|json|md|css|scss|html|py|go|rs|java|rb|sql|ya?ml|toml)\b|\b(export|exports|import|imports|function|class|interface|type|schema|module|component|route|endpoint|operation|command|setting|settings|config|field|enum|const|method|prop|props|symbol|package|namespace|hook|reducer|selector|migration)s?\b/i;

/**
 * Proof or auditable opt-out signal. A `Precondition:`/`Proof:` marker (the
 * opt-out form is `Precondition: none — <reason>`), or an actual search command
 * that establishes the consumer set.
 */
const PROOF = /\b(precondition|proof)\b\s*:|\b(grep|rg|ripgrep|ast-grep|ast_grep)\b/i;

export interface PreconditionGap {
  id: string;
  /** The destructive verb phrase that triggered the check. */
  matched: string;
}

/** Returns true when text describes a destructive change to a codebase target. */
export function isDestructiveTaskText(text: string): boolean {
  return DESTRUCTIVE.test(text) && CODEBASE_TARGET.test(text);
}

/** Returns true when text carries a proof command or an auditable opt-out. */
export function hasPreconditionProof(text: string): boolean {
  return PROOF.test(text);
}

/**
 * Find tasks that describe a destructive codebase change but carry no proof
 * command or opt-out. Scans description + details together.
 */
export function detectPreconditionGaps(
  tasks: ReadonlyArray<{ id: string; description: string; details?: string }>,
): PreconditionGap[] {
  const gaps: PreconditionGap[] = [];
  for (const task of tasks) {
    const text = `${task.description}\n${task.details ?? ''}`;
    if (!isDestructiveTaskText(text)) continue;
    if (hasPreconditionProof(text)) continue;
    const matched = DESTRUCTIVE.exec(text)?.[0] ?? 'destructive change';
    gaps.push({ id: task.id, matched });
  }
  return gaps;
}

/** Human-readable rejection message for the agent to act on. */
export function formatPreconditionRejection(gaps: PreconditionGap[]): string {
  const list = gaps.map((g) => `  • ${g.id} ("${g.matched}")`).join('\n');
  return (
    `Plan NOT saved — precondition gate failed for ${gaps.length} destructive ` +
    `task(s):\n${list}\n\n` +
    `Each task above deletes/removes/renames a codebase target but carries no ` +
    `precondition proof. In the task's details, add ONE of:\n` +
    `  1. A proof command that establishes the consumer set, scoped by feature ` +
    `not directory — e.g. \`Proof: rg "ExportedSymbol" -l\` (run it for EVERY ` +
    `exported symbol being removed, not just the type/feature name), OR\n` +
    `  2. An explicit, auditable opt-out: \`Precondition: none — <reason it has ` +
    `no consumers>\`.\n\n` +
    `Then call submit_plan again. This is deterministic input validation, not a review.`
  );
}

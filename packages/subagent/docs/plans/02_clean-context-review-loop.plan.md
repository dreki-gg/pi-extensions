---
name: "Clean-context review loop"
overview: "Refactor the existing implement→review→fix workflow so the reviewer starts from the diff and a minimal handoff instead of inheriting the worker’s full narrative. This slice should preserve the current single-writer loop while making review less correlated with generation."
todo:
  - id: "clean-review-1"
    task: "Tighten the reviewer prompt so review starts from `git diff` and re-discovered code context, not from the worker’s rationale"
    status: pending
  - id: "clean-review-2"
    task: "Change the worker output contract so implementation handoff exposes exact files, symbols, validation, and unresolved risks in a compact review packet"
    status: pending
  - id: "clean-review-3"
    task: "Rewrite `/implement-and-review` to pass only the minimal review packet and findings needed for the next step"
    status: pending
---

# Goal

Improve the bundled review loop so the reviewer reasons from a fresh, diff-first context and the worker only receives actionable findings back.

# Context

- Parent rationale: we want the reviewer to act as a clean-context verifier rather than a second pass over the worker’s self-explanation.
- Module root: `packages/subagent`
- This slice must work against the current package even if the structured-handoff plan has not landed yet.
- Keep the package philosophy intact: one writer (`worker`) plus verifier intelligence (`reviewer`), not competing writers.

## What exists

Current relevant file tree on disk:

- `packages/subagent/agents/reviewer.md`
- `packages/subagent/agents/worker.md`
- `packages/subagent/prompts/implement-and-review.md`
- `packages/subagent/skills/spawn-subagents/SKILL.md`
- `packages/subagent/extensions/subagent/index.ts`
- `packages/subagent/README.md`

Actual current behavior on disk:

- The bundled review workflow is a plain chain prompt. `packages/subagent/prompts/implement-and-review.md:4-10` tells the main agent to:
  1. run `worker` to implement `$@`
  2. run `reviewer` “to review the implementation from the previous step (use {previous} placeholder)”
  3. run `worker` again to apply review feedback from `{previous}`
- Chain execution in `packages/subagent/extensions/subagent/index.ts:658-716` performs raw `{previous}` replacement with the previous step’s final assistant text. There is no review-specific minimization layer in code today.
- The current reviewer prompt already points in the right direction:
  - `packages/subagent/agents/reviewer.md:12-18` restricts bash to read-only commands and tells the agent to start with `git diff`, then read modified files.
  - But the prompt does **not** explicitly tell the reviewer to distrust or deprioritize the worker’s implementation narrative when that narrative is also passed through `{previous}`.
- The current worker prompt includes a helpful but minimal handoff hint:
  - `packages/subagent/agents/worker.md:13-26` asks for `Completed`, `Files Changed`, and `Notes`, and says that if handing off to another agent it should include exact file paths changed and key functions/types touched.
  - There is no required section for validation run, constraints, or unresolved risk, so the review handoff is underspecified.
- The `spawn-subagents` skill currently recommends a `reviewer` loop after implementation and says the main agent may apply fixes directly or send a focused follow-up to `worker` (`packages/subagent/skills/spawn-subagents/SKILL.md:44-58`). It does not yet describe “clean context” review explicitly.
- There is no additional workflow prompt for “clean review”; the current `/implement-and-review` prompt is the only bundled implementation review loop.

# API inventory

## Existing reviewer and worker contracts

From `packages/subagent/agents/reviewer.md`:

```md
Strategy:
1. Run `git diff` to see recent changes (if applicable)
2. Read the modified files
3. Check for bugs, security issues, code smells

Output format:
## Files Reviewed
- `path/to/file.ts` (lines X-Y)

## Critical (must fix)
- `file.ts:42` - Issue description

## Warnings (should fix)
- `file.ts:100` - Issue description

## Suggestions (consider)
- `file.ts:150` - Improvement idea

## Summary
Overall assessment in 2-3 sentences.
```

From `packages/subagent/agents/worker.md`:

```md
Output format when finished:

## Completed
What was done.

## Files Changed
- `path/to/file.ts` - what changed

## Notes (if any)
Anything the main agent should know.

If handing off to another agent (e.g. reviewer), include:
- Exact file paths changed
- Key functions/types touched (short list)
```

## Existing workflow prompt shape

From `packages/subagent/prompts/implement-and-review.md`:

```md
1. First, use the "worker" agent to implement: $@
2. Then, use the "reviewer" agent to review the implementation from the previous step (use {previous} placeholder)
3. Finally, use the "worker" agent to apply the feedback from the review (use {previous} placeholder)
```

## Existing chain plumbing in code

From `packages/subagent/extensions/subagent/index.ts`:

```ts
const taskWithContext = step.task.replace(/\{previous\}/g, previousOutput);
...
previousOutput = getFinalOutput(result.messages);
```

This means the review workflow can be improved significantly even with prompt-only changes, because the thing being substituted is whatever the worker chose to emit as final text.

# Tasks

## 1. Tighten the reviewer prompt so review starts from `git diff` and re-discovered code context

### Files
- Modify `packages/subagent/agents/reviewer.md`

### What to change
- Keep the reviewer read-only.
- Make “diff first, repo second, worker narrative last” an explicit rule.
- Tell the reviewer to use the incoming handoff only for:
  - the original goal
  - exact file paths / symbols to inspect first
  - any explicit constraints that must not be violated
- Tell the reviewer to challenge assumptions openly when the diff suggests a bug, insecure pattern, or scope creep.
- Add a rule that the reviewer should request more investigation rather than hallucinate missing repo context.

### Recommended prompt additions
- Add a short “Rules” section such as:
  1. Start with `git diff` / `git show`; do not trust the generator’s explanation over the code.
  2. Use the incoming handoff only as a pointer to files, constraints, and touched symbols.
  3. Re-discover missing context from the repo yourself.
  4. If a claim cannot be verified from diff or code, say so explicitly.
- Keep the current output sections, but add a mandatory “No findings” bullet format when the diff looks good.

## 2. Change the worker output contract so implementation handoff becomes a compact review packet

### Files
- Modify `packages/subagent/agents/worker.md`

### What to change
- Keep the worker autonomous and implementation-focused.
- Expand the finish contract so a downstream reviewer gets a compact, machine-readable packet.

### Required output structure

```md
## Completed
- concise implementation summary

## Files Changed
- `path/to/file.ts` - what changed

## Key Symbols Touched
- `functionName`
- `TypeName`

## Validation
- command run / not run
- result

## Constraints Followed
- user constraints that shaped the implementation

## Open Risks or Unknowns
- anything the reviewer should pressure-test
```

### Notes
- Do not ask the worker to justify every design choice in prose; that would reintroduce context bloat.
- The goal is a review packet, not a diary.

## 3. Rewrite `/implement-and-review` to pass only the minimal review packet and findings needed for the next step

### Files
- Modify `packages/subagent/prompts/implement-and-review.md`

### What to change
- Replace the vague “review the implementation from the previous step” language with explicit review behavior.
- The prompt should instruct the main agent to pass a **minimal** handoff to `reviewer`:
  - goal
  - exact files changed
  - touched symbols
  - constraints followed
  - open risks / unknowns
- The prompt should instruct the reviewer to start from `git diff`, not from the packet itself.
- The prompt should instruct the final `worker` step to apply only concrete review findings, not to rewrite code based on generic commentary.

### Suggested prompt shape

```md
1. Use `worker` to implement: $@
2. Use `reviewer` to perform a diff-first review. Treat the previous step only as a compact review packet (goal, files changed, key symbols, constraints, open risks). Re-discover repo context from the diff and files as needed.
3. Use `worker` to address concrete Critical and Warning findings from the review. Ignore Suggestions unless they clearly fit scope.
```

### Optional follow-up
- If, during implementation, you find the package benefits from a second prompt template instead of changing the default one, create `packages/subagent/prompts/implement-and-clean-review.md` and keep `/implement-and-review` as a thin wrapper or conservative alias.
- If you choose that route, document the reason in the plan output and README follow-up notes.

# Files to create

- None required for the first iteration

# Files to modify

- `packages/subagent/agents/reviewer.md` — make clean-context review an explicit prompt rule
- `packages/subagent/agents/worker.md` — emit a compact review packet instead of only freeform notes
- `packages/subagent/prompts/implement-and-review.md` — encode diff-first review semantics in the bundled workflow

# Testing notes

- No TypeScript changes are required unless you choose to add a helper module, so package validation is primarily manual.
- Run a small local `/implement-and-review` workflow and verify:
  - the reviewer starts from `git diff`
  - the reviewer output references concrete files/lines
  - the worker’s second pass applies Critical/Warning items rather than rewriting everything
- If you add any TS helper to support review packet rendering, run `bun run --filter '@dreki-gg/pi-subagent' typecheck`.
- Do not assume the structured-handoff slice already exists. This prompt-level refactor should still improve behavior on its own.

# Patterns to follow

- `packages/subagent/agents/reviewer.md:12-18` — existing diff-first reviewer stance to strengthen, not replace
- `packages/subagent/agents/worker.md:24-26` — current handoff hints to make mandatory and more compact
- `packages/subagent/prompts/implement-and-review.md:4-10` — current workflow entry point to refine
- `packages/subagent/skills/spawn-subagents/SKILL.md:44-58` — current review-loop guidance
- `packages/subagent/skills/write-an-agent/SKILL.md:15-20` and `:62-67` — keep prompt files sharp, minimal, and output-contract-driven

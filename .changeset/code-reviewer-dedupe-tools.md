---
'@dreki-gg/pi-code-reviewer': minor
---

fix(code-reviewer): dedupe + bound lens tool execution; configurable timeout/concurrency

- Lens tools are now deduped across the selected lenses and run **once**,
  concurrently — a command shared by several lenses (e.g. `npm run test`) no
  longer re-runs per lens. Previously N lenses listing the same tool ran it N
  times.
- The `code_review` tool now embeds the diff **once** (followed by per-lens
  sections) instead of repeating the full diff inside every lens prompt — large
  diffs no longer bloat the tool output. (The `/review` command already did
  this; the tool path now matches.)
- New `.code-review.json` knobs: `toolTimeoutMs` (default 60000) and
  `toolConcurrency` (default 4), both validated as positive integers.
- `/review-init` scaffold now instructs that lens `## Tools` must be fast,
  self-exiting commands (no dev servers, watch mode, e2e, or full builds — that
  is CI's job), since tools run on every review.
- The `code_review` tool no longer renders a findings scoreboard / "No
  findings ✓" report that always read zero (findings are produced by the agent
  in its follow-up, not parsed back) — it now returns an honest pre-review
  skeleton (changes + per-lens criteria/tool-outputs + the review task).
  Removed the now-dead `report.ts` / `ReviewReport`.
- `git diff` invocations are bounded by a 30s timeout, and the default diff
  path falls back to the working tree when `HEAD` is unborn (fresh repo with
  no commits) instead of failing the whole review.
- Diff truncation now cuts at a line boundary so the embedded diff never ends
  mid-hunk.

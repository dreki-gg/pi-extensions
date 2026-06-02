# @dreki-gg/pi-code-reviewer

## 0.4.0

### Minor Changes

- 027bf75: fix(code-reviewer): dedupe + bound lens tool execution; configurable timeout/concurrency

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

## 0.3.0

### Minor Changes

- d9cbc6e: refactor(code-reviewer): adopt Effect for IO and side effects

  - Disk access (`.code-review.json`, lens markdown) and subprocess execution
    (`git` diffs, lens tools via `pi.exec`) now run as Effect programs against
    injectable `FileSystem` and `Executor` services, with `Data.TaggedError`
    types (`FileReadError`, `ExecError`), mirroring the conventions used by the
    firestore and lsp packages.
  - Each module exposes a typed `*Effect` implementation plus a Promise wrapper
    that provides the live services, so command/tool call sites stay thin.
  - Added a test suite (config, lens discovery/parsing, diff collection, lens
    review) driven entirely through service injection — no real disk or
    subprocess access required.

## 0.2.0

### Minor Changes

- [`3fe2f35`](https://github.com/dreki-gg/pi-extensions/commit/3fe2f35f8e6aa124194571e349665062d85056ef) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Show review progress in the status bar during `/review` and `code_review` tool execution. Fix output truncation in `/review` by including the diff only once instead of duplicating it per lens.

## 0.1.1

### Patch Changes

- [`7835e24`](https://github.com/dreki-gg/pi-extensions/commit/7835e24d02d14f0da00d9ebb136cf54f4cd23ecb) Thanks [@jalbarrang](https://github.com/jalbarrang)! - docs(code-reviewer): update lenses examples to better generalize and illustrate how the extension and its skills should work

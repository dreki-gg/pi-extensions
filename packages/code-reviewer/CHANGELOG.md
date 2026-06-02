# @dreki-gg/pi-code-reviewer

## 0.5.0

### Minor Changes

- feat(code-reviewer): self-driving Bugbot-style review pipeline

  The `code_review` tool can now run the review itself instead of only
  returning a prompt for a single downstream pass. When a session model is
  available it drives a multi-stage pipeline modeled on Cursor's Bugbot:

  1. **N parallel adversarial passes** over the diff (default 5), each given a
     different focus (trust boundaries, control flow, async, types, state,
     security, resources, contracts) and a temperature jitter so they reason
     down different paths.
  2. **Bucket + majority vote** — near-duplicate findings are fused (same file +
     line proximity + message similarity) and tracked by distinct-pass votes;
     low-signal single-pass notes are dropped (blockers/warnings are never
     dropped for low votes).
  3. **Validator stage** — one batched call falsifies or confirms each surviving
     candidate, dropping false positives. It **fails open**: a validator error
     surfaces candidates unvalidated rather than losing a real bug.

  The tool returns finished, validated findings as a Markdown report (with vote
  counts, confidence, and validator justification) plus structured `details`.
  When no model is available (e.g. print mode) or `review.passes` is `0`, it
  falls back to the previous single-pass prompt behavior.

  New `.code-review.json` `review` block: `passes` (default 5, `0` disables),
  `validate` (default true), `minVotes` (default 2), `concurrency` (default =
  passes), `temperature` (default 0.4), `maxFindings` (default 50).

  **Per-step model + reasoning selection (model bake-off).** `review.passModel` /
  `review.passModels` (rotated round-robin across passes) / `review.validateModel`
  let each step run on a different model AND reasoning level so you can A/B which
  models / efforts review best / fastest / cheapest in a single run. Each step is
  a spec string (`provider/id`, a bare `id`, or a display `name`) or
  `{ "model", "reasoning" }` where reasoning is `minimal|low|medium|high|xhigh`.
  Unknown specs fall back to the session model with a warning. Findings are
  annotated with the contributing model(s) and the report shows a per-model
  breakdown.

  The scaffolded `code-quality` lens gains an **adversarial-inputs** criterion
  (edge-value enumeration + claim-vs-code audit) — the class of check that
  catches bugs like `typeof NaN === "number"` defeating a version guard.

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

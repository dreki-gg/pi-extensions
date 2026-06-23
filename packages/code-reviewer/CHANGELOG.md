# @dreki-gg/pi-code-reviewer

## 0.8.0

### Minor Changes

- 6efb045: Add a `--repo` flag (alias `--cwd`) to `/review` and a `cwd` parameter to the
  `code_review` tool so reviews can target a git worktree or sibling repo without
  leaving the session. The override is resolved relative to the session directory
  and validated as a git work tree; `.code-review.json`, lenses, and recorded
  rejections all resolve relative to it, while the session directory is left
  unchanged.

## 0.7.0

### Minor Changes

- Add recorded rejections to the review pipeline. Validator false-positives are
  now persisted to `.code-review/rejections.jsonl`, and on later runs any finding
  that matches a past rejection is downranked and tagged `⟲ previously rejected`
  — never hidden, so resurfaced false-positives sink below fresh findings without
  silently suppressing anything. The store dedupes and is capped, and persistence
  is best-effort (an FS error never breaks a review). Toggle with
  `review.recordRejections` (default true); path via `rejectionsFile`.

## 0.6.2

### Patch Changes

- fix(code-reviewer): degrade gracefully when the review temp-file write fails

  The temp-file spill added in 0.6.1 introduced filesystem IO on the tool's
  output path, which could throw (read-only `TMPDIR`, full disk, sandbox) and
  sink an otherwise-successful review. The write is now best-effort:

  - **Pipeline mode** still returns its validated findings if the spill write
    fails — only the diff pointer is dropped (the findings are the valuable
    output, not the convenience file).
  - **Single-pass fallback** degrades to returning the inline context
    (truncation-prone, but a real review beats a hard tool error) instead of
    throwing out of `execute`.
  - A review with **no applicable lenses** now reports that explicitly instead of
    writing an empty temp file and pointing the agent at it.

  Internals: the two output-assembly branches were extracted into pure,
  injectable functions (`buildSinglePassResult`, `buildPipelineResult`) with the
  temp-file writer passed in, so the empty-context and write-failure paths are
  covered by unit tests.

## 0.6.1

### Patch Changes

- fix(code-reviewer): spill full review context to a temp file to avoid truncation

  The `code_review` tool output was being truncated by pi's built-in ~50KB /
  2000-line tool-output cap (and further serialized to ~2000 chars on
  compaction), so the reviewing agent often worked with incomplete review data.

  - **Single-pass fallback (the primary culprit) now writes the full context to
    a temp file.** It embedded the whole diff (up to 50KB) plus every lens's tool
    outputs (20KB each), which easily exceeded the cap. The tool now writes the
    full context (diff, lens definitions, tool outputs, instructions) to
    `os.tmpdir()/pi-code-review-{ts}.md` and returns a compact inline summary
    (lenses + diff scope) plus a pointer telling the agent to `read` the file —
    paging large content with `read` offset/limit (the `read` tool shares the
    same cap).
  - **Pipeline mode keeps findings inline** (already compact) but also spills the
    diff + lens context to the same temp file and appends a pointer, so the agent
    can drill into the diff behind a finding without truncation.
  - Both paths expose the temp file path via `details.contextFile`.

## 0.6.0

### Minor Changes

- 2d0ef5d: fix(code-reviewer): review untracked files + stop reporting failed passes as a clean review

  - **Untracked (brand-new) files are now reviewed.** The default
    working-directory diff used `git diff HEAD`, which silently omits files that
    have never been `git add`ed — exactly the new files agents create. It now
    merges tracked changes with untracked files (diffed against `/dev/null` via
    `git diff --no-index`), so a review covers everything uncommitted. The
    collection is **read-only** (never `git add -N`), capped at 200 untracked
    files, and degrades per-file on failure. `--stat` is annotated with the new
    files, and `getChangedFiles` mirrors the merged set (deduped). `--staged` and
    `--base` keep pure git semantics (no untracked files).
  - **Failed passes no longer masquerade as "0 findings ✅".** A pass that errors
    (e.g. the review model / pi-ai is unavailable) was swallowed into an empty
    result, so an all-failed run rendered as a clean review. The pipeline now
    captures a representative error (`telemetry.passErrorSample`) and the report
    is honest: an all-failed run is **Inconclusive** (no green check), a partial
    failure is flagged as **Partial review (M/N passes failed)**, and findings
    produced alongside failures carry a reduced-coverage warning.
  - When **every** pass fails, the tool degrades to the single-pass fallback so
    the reviewing agent still produces a real review instead of an empty report.

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

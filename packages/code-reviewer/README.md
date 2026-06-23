# @dreki-gg/pi-code-reviewer

Multi-lens code review extension for [pi](https://github.com/earendil-works/pi). Reviews working directory changes through configurable criteria lenses — each project defines its own review standards and tooling.

## Install

```bash
pi install npm:@dreki-gg/pi-code-reviewer
```

This is a **project-local** extension. Install it per-project so each project can configure its own lenses and tools.

## Setup

After installing, scaffold the review configuration:

```
/review-init
```

This creates:
- `.code-review.json` — config file (lens directory, default lenses)
- `.code-review/lenses/` — lens definition files

## Usage

```
/review                          # Review all changes with all lenses
/review --lens code-quality      # Single lens
/review --lens quality,ux        # Multiple lenses
/review --base main              # Diff against a branch
/review --staged                 # Only staged changes
/review --repo ../project-pr35    # Review a worktree / sibling repo
/review-lenses                   # List available lenses
```

### Reviewing worktrees & other repos (`--repo`)

By default `/review` runs git against the Pi session directory. Pass `--repo <dir>`
(alias `--cwd <dir>`) to target a different directory — a git worktree (sibling or
nested) or another repo — without leaving the session:

```
/review --repo /path/to/worktree --base HEAD~1 --lens code-quality,architecture
```

- The path is resolved relative to the session directory and validated as a git
  work tree (relative paths like `../project-pr35` work).
- `.code-review.json`, lenses, and recorded rejections all resolve relative to the
  override directory.
- The session directory itself is left unchanged — only git/config/lens resolution
  is redirected.

The `code_review` tool exposes the same override via its optional `cwd` parameter.

## How the review runs (Bugbot-style pipeline)

When a session model is available, the `code_review` tool **runs the review
itself** rather than returning a prompt for one downstream pass. It drives a
multi-stage pipeline modeled on Cursor's Bugbot:

1. **Parallel adversarial passes** (default 5) over the diff. Each pass gets a
   different focus — trust boundaries, control flow, async/lifecycle, types,
   state integrity, security, resources, contracts — plus a temperature jitter,
   so passes reason down different paths instead of collapsing onto the same
   findings.
2. **Bucket + majority vote.** Near-duplicate findings are fused (same file +
   line proximity + message similarity) and tracked by how many distinct passes
   surfaced them. Low-signal single-pass *notes* are dropped; blockers and
   warnings are never dropped for low votes.
3. **Validator stage.** One batched call tries to *falsify* each surviving
   candidate and drops false positives. It **fails open** — if the validator
   errors, candidates are surfaced unvalidated rather than silently lost.

4. **Recorded rejections.** The candidates the validator refutes are appended to
   `.code-review/rejections.jsonl`. On later runs, any finding that matches a
   past rejection is **downranked and tagged** `⟲ previously rejected` — never
   hidden, so nothing is silently suppressed, but resurfaced false-positives
   sink below fresh findings. The store dedupes and is capped. Persisting is
   best-effort: an FS error never breaks a review. Disable with
   `review.recordRejections: false`.

The tool returns finished, validated findings as a Markdown report (vote count,
confidence, validator justification) plus structured `details`.

**Fallback:** if no model is available (e.g. print mode) or `review.passes` is
`0`, the tool returns the previous single-pass review prompt and the calling
agent produces findings in its follow-up message.

## Lenses

A lens is a markdown file that defines review criteria, project tools to run, and severity rules:

```md
# Code Quality

Evaluates changes for correctness and adherence to project standards.

## Criteria
- Does the diff introduce new type errors?
- Are there new unused exports?
- Does the change follow naming conventions?

## Tools
- `npm run typecheck`
- `npm run lint`

## Severity
- blocker: Type errors, unresolved imports
- warning: New lint violations, unused code
- note: Style suggestions
```

> **Tools must be fast and exit on their own** (typecheck, lint, unit tests).
> Do **not** list dev servers, watch mode, e2e suites, or full production
> builds — they bind ports / run for minutes and belong in CI. Tools are
> **deduped across lenses and run concurrently**, so a command shared by
> several lenses runs once, and a slow/hanging command stalls the whole review
> (bounded by `toolTimeoutMs`).

### Bundled lenses

The package ships with four example lenses:

| Lens | Focus |
| --- | --- |
| `code-quality` | Correctness, lint, types, dead code |
| `maintainability` | Coupling, complexity, readability |
| `product-vision` | Traces changes back to their originating issue or design doc, checks goal alignment |
| `accessibility` | Semantic HTML, keyboard navigation, ARIA, screen reader compatibility |

Run `/review-init` to scaffold these (customized for your project's tools) into `.code-review/lenses/`.

## Configuration

`.code-review.json`:

```json
{
  "lensDir": ".code-review/lenses",
  "defaultLenses": ["code-quality", "maintainability"],
  "toolTimeoutMs": 60000,
  "toolConcurrency": 4,
  "review": {
    "passes": 5,
    "validate": true,
    "minVotes": 2,
    "concurrency": 5,
    "temperature": 0.4,
    "maxFindings": 50,
    "passModels": [{ "model": "anthropic/claude-opus-4-8", "reasoning": "low" }],
    "validateModel": { "model": "anthropic/claude-opus-4-8", "reasoning": "medium" }
  }
}
```

| Field | Default | Description |
| --- | --- | --- |
| `lensDir` | `.code-review/lenses` | Directory containing lens files |
| `defaultLenses` | `[]` (all) | Lenses to run when none specified |
| `toolTimeoutMs` | `60000` | Per-tool wall-clock timeout (ms); an exceeding tool is killed and reported as timed-out |
| `toolConcurrency` | `4` | Max distinct tools run in parallel (tools are deduped across lenses first) |
| `review.passes` | `5` | Parallel adversarial bug-finding passes. `0` disables the pipeline (single-pass prompt fallback). |
| `review.validate` | `true` | Run the validator stage that falsifies each surviving candidate. |
| `review.minVotes` | `2` | Min distinct passes a NOTE bucket needs to survive pre-validation (blockers/warnings exempt). |
| `review.concurrency` | `= passes` | Max passes run concurrently. |
| `review.temperature` | `0.4` | Base sampling temperature; each pass adds a small jitter so passes diverge. |
| `review.maxFindings` | `50` | Hard cap on findings returned. |
| `review.recordRejections` | `true` | Persist validator false-positives and downrank+tag matches on later runs. |
| `rejectionsFile` | `.code-review/rejections.jsonl` | Path (relative to cwd) of the recorded-rejections store. |
| `review.passModel` | session model | Model for ALL passes: a spec string (`"provider/id"`, bare id, or name) or `{ "model", "reasoning" }`. |
| `review.passModels` | — | List of models **rotated round-robin across passes** — a bake-off in one run. Overrides `passModel`. |
| `review.validateModel` | session model | Model for the validator stage (string or `{ "model", "reasoning" }`). |

Each step accepts either a plain spec string or `{ "model": "provider/id", "reasoning": "low" }`
where `reasoning` is one of `minimal` / `low` / `medium` / `high` / `xhigh` (applied as the
thinking effort for that step; ignored by providers that don't support it).

> By default the pipeline reuses the **session's current model** (`ctx.model`) —
> no separate API key or model config. More passes = deeper coverage but higher
> token/latency cost; tune `review.passes` to taste (3 = cheap, 8 = Bugbot
> parity).
>
> **Model bake-off.** Set `passModels` to a list to run the same diff through
> several models in one review and compare. Models are assigned round-robin to
> passes, each finding is annotated with the model(s) that caught it, and the
> report shows a per-model breakdown. Use a cheap model for `passModels` and a
> stronger one for `validateModel` (or vice-versa) to probe the speed/cost/
> quality frontier. Specs are matched as `provider/id`, a bare `id`, or a
> display `name`; an unknown spec falls back to the session model with a warning.


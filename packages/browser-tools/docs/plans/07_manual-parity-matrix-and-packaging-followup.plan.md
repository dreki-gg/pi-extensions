---
name: "Manual parity matrix + packaging follow-up"
overview: "Validate the Playwright and agent-browser backends against the same small workflow matrix, then record the evidence needed to decide whether browser-tools should stay a single package or split into a sister package later."
todo:
  - id: "parity-matrix-1"
    task: "Add a tiny deterministic fixture and a checked-in manual parity runbook for both backends"
    status: pending
  - id: "parity-matrix-2"
    task: "Run the manual matrix for Playwright and agent-browser, then record pass/fail notes and known gaps in a checked-in results document"
    status: pending
  - id: "parity-matrix-3"
    task: "Use the parity evidence to record the packaging decision: keep one package, split a sister package, or defer publication of the agent-browser backend"
    status: pending
---

# Goal

Create a small, repeatable parity process that compares the two backends against the same scenarios, then use the results to decide packaging direction instead of guessing up front.

# Context

- Parent feature: dual-backend browser-tools with Playwright and `agent-browser`.
- This slice depends on:
  - `04_browser-backend-interface-and-playwright-adapter.plan.md`
  - `05_agent-browser-cli-backend.plan.md`
  - `06_backend-selection-and-compatibility.plan.md`
- Approved direction from the conversation:
  - do parity work before deciding packaging direction
  - do not redesign the public API around agent-browser refs yet
  - keep packaging direction undecided until evidence exists
- This slice is intentionally evidence-first. Do not split packages before the matrix has been run and written down.

## What exists

Actual current package/repo state today:

- `packages/browser-tools` has no test directory beyond docs/plans artifacts.
- There is no parity fixture page in the package.
- There is no checked-in manual QA runbook for browser-tools.
- There is no document in this repo that compares Playwright and `agent-browser` behavior for the same tool calls.
- The root `README.md` currently advertises only the Playwright-shaped browser-tools package and says nothing about backend choice.
- There is no ADR or package decision doc for browser-tools packaging direction.

Useful existing patterns in the repo:

- `packages/lsp/test/index.test.ts` shows how package-local harnesses instantiate a real extension entrypoint without pi UI.
- `packages/browser-tools/README.md` is the right place for end-user install notes, but it is not the right place for a detailed parity matrix table.
- `docs/` at the repo root already holds architecture-oriented notes (`PI_HOME_AUDIT.md`, `SUBAGENT_ARCHITECTURE.md`), so a packaging decision record can live there if it becomes repo-level.

# API inventory

## Public tool surface to compare in the matrix

Compare these tools across both backends using the same inputs wherever possible:

```ts
web_visit { url: string; render?: boolean }
web_screenshot { url?: string; viewport?: 'desktop' | 'mobile'; width?: number; height?: number }
web_interact {
  action: 'click' | 'type' | 'scroll' | 'select' | 'hover' | 'wait';
  selector?: string;
  text?: string;
  value?: string;
  direction?: 'up' | 'down';
  amount?: number;
  timeout?: number;
}
web_console {
  level?: Array<'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace' | 'page-error'>;
  clear?: boolean;
}
```

## Minimum parity scenarios

The matrix should cover one static page and one interactive deterministic page.

### Static page scenarios
- `web_visit` with `render: false`
- `web_visit` with `render: true`
- `web_screenshot` desktop
- `web_screenshot` mobile

### Interactive page scenarios
- `web_interact` click via `selector`
- `web_interact` type via `selector`
- `web_interact` select via `selector`
- `web_interact` click via `text` (expected to be best-effort)
- `web_console` before clear
- `web_console` after `clear: true`

## Packaging decision options to evaluate after the matrix

Record one of these explicit outcomes after evidence is collected:

1. **Keep one package**
   - `@dreki-gg/pi-browser-tools`
   - Playwright default
   - `agent-browser` optional via env selection
2. **Create a sister package**
   - keep Playwright package stable
   - add something like `@dreki-gg/pi-agent-browser-tools`
3. **Defer public packaging of agent-browser**
   - keep the backend in-repo but experimental/private until gaps are closed

Evaluation criteria:

- install UX
- runtime reliability
- compatibility with current tool args
- support burden implied by external CLI dependency
- whether `web_interact.text` gaps are acceptable for public users

# Tasks

## 1. Add a tiny deterministic fixture and a checked-in manual parity runbook for both backends

### Files
- Create `packages/browser-tools/test/manual/parity-fixture.html`
- Create `packages/browser-tools/docs/manual-parity-matrix.md`

### What to add
- A local HTML fixture page with deterministic behavior:
  - article text for `web_visit`
  - one button that changes visible state when clicked
  - one text input
  - one select element
  - `console.log`, `console.warn`, and a deliberate thrown error or rejected promise for console/error coverage
  - stable IDs or `data-testid` selectors for each target
- A manual parity runbook that tells the operator exactly how to compare both backends.

### Runbook contents
- prerequisites:
  - package built/typechecked
  - `agent-browser` installed and initialized
  - backend selection env var values
- a short local serving instruction for the fixture page
- exact matrix rows with columns like:
  - scenario
  - backend
  - input
  - expected visible outcome
  - expected details shape
  - notes

## 2. Run the manual matrix for Playwright and agent-browser, then record pass/fail notes and known gaps in a checked-in results document

### Files
- Create `packages/browser-tools/docs/manual-parity-results.md`

### What to add
- A checked-in table or checklist with one row per scenario per backend.
- Record:
  - pass/fail
  - screenshots or output snippets when useful
  - whether the result shape remained compatible
  - whether the user had to switch from `text` to `selector`
  - whether console output looked materially different
- Call out any gaps that are acceptable versus blockers.

### Required judgment calls to record
- Is `web_interact.text` good enough as best-effort for `agent-browser`, or does it fail often enough that public packaging should wait?
- Does `web_visit render:true` produce sufficiently similar markdown/title output on both backends?
- Is the CLI requirement acceptable for the package audience, or does it push the backend toward “experimental only” status?

## 3. Use the parity evidence to record the packaging decision: keep one package, split a sister package, or defer publication of the agent-browser backend

### Files
- Create `packages/browser-tools/docs/packaging-decision.md`
- Modify `README.md` only if the decision is ready for broad repo-level advertising

### What to add
- A short decision record that captures:
  - decision date
  - parity evidence source (`manual-parity-results.md`)
  - chosen packaging direction
  - rationale
  - immediate next steps
- Only update the root repo README if the parity result supports public-facing messaging.
- If the result is inconclusive or negative, keep the decision doc explicit about what blocks broader packaging.

# Files to create

- `packages/browser-tools/test/manual/parity-fixture.html`
- `packages/browser-tools/docs/manual-parity-matrix.md`
- `packages/browser-tools/docs/manual-parity-results.md`
- `packages/browser-tools/docs/packaging-decision.md`

# Files to modify

- `README.md` — only after the packaging decision is made and worth advertising repo-wide

# Testing notes

- This slice is intentionally manual. Do not over-engineer a full CI harness before the parity question is answered.
- Suggested operator flow:

```bash
bun run --filter '@dreki-gg/pi-browser-tools' typecheck
# serve parity-fixture.html locally
PI_BROWSER_BACKEND=playwright   # run matrix
PI_BROWSER_BACKEND=agent-browser # run matrix again
```

- Keep the fixture local and deterministic so backend differences are easier to attribute to the engine rather than the target site.

# Patterns to follow

- `packages/lsp/test/index.test.ts` — if the implementer wants a tiny local harness to help execute the matrix without the pi UI
- `packages/browser-tools/README.md` — for concise user-facing notes, not the full matrix itself
- `docs/SUBAGENT_ARCHITECTURE.md` — example of a repo-level decision note when a conclusion eventually needs broader visibility

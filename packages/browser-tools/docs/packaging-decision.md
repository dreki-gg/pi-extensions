# Packaging decision

Decision date: 2026-04-23

Evidence source:

- `packages/browser-tools/docs/manual-parity-results.md`

## Decision

**Keep one package**:

- package name stays `@dreki-gg/pi-browser-tools`
- Playwright stays the default backend
- `agent-browser` remains an opt-in backend selected with `PI_BROWSER_BACKEND=agent-browser`
- do **not** create a sister package right now
- do **not** add broader repo-level marketing for `agent-browser` yet

## Rationale

The manual parity rerun was good enough to keep the packaging decision grounded in evidence:

- Playwright passed the full local matrix.
- `agent-browser` also passed the full local matrix on the same deterministic fixture after the console-clear fix.
- `web_interact.text` worked on the local fixture, so text targeting is not an immediate packaging blocker, even though it should remain documented as best-effort.
- `web_visit render:true` stayed API-compatible across both backends even though the extracted markdown differed in length and shape.

A sister package would increase install and support complexity without solving the actual remaining problem:

- the external CLI dependency is still the same dependency
- the public tool API is still the same API
- the real follow-up work is closing backend gaps, not multiplying package surfaces

So the evidence favors one package with:

- stable default behavior through Playwright
- opt-in backend selection for advanced users
- package-local documentation for known `agent-browser` caveats

## What this decision does **not** mean

- It does **not** mean `agent-browser` has full parity yet.
- It does **not** justify root README promotion today.
- It does **not** upgrade `web_interact.text` beyond best-effort guidance.

## Immediate next steps

1. Keep parity evidence package-local and rerun the fixture after backend changes.
2. Continue documenting `agent-browser` caveats as backend-specific notes instead of changing the public tool shape.
3. Reconsider broader messaging only after repeated parity passes stay green.

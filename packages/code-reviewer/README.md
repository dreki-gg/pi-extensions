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
/review-lenses                   # List available lenses
```

The `code_review` tool is also available for programmatic use by the agent.

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
  "toolConcurrency": 4
}
```

| Field | Default | Description |
| --- | --- | --- |
| `lensDir` | `.code-review/lenses` | Directory containing lens files |
| `defaultLenses` | `[]` (all) | Lenses to run when none specified |
| `toolTimeoutMs` | `60000` | Per-tool wall-clock timeout (ms); an exceeding tool is killed and reported as timed-out |
| `toolConcurrency` | `4` | Max distinct tools run in parallel (tools are deduped across lenses first) |


# @dreki-gg/pi-questionnaire

Tool-first questionnaire extension for pi.

It adds:
- a `questionnaire` tool for collecting **1-5 structured answers** in one interaction
- a `/questionnaire` demo command powered by the same shared tabbed TUI flow

## Install

```bash
pi install npm:@dreki-gg/pi-questionnaire
```

## What it provides

| Feature | Name | Notes |
|---|---|---|
| Tool | `questionnaire` | Collects structured user answers with single/multi select + optional Other text |
| Command | `/questionnaire` | Demo flow using `Scope`, `Priority`, `Approach` |

## Input schema (summary)

```ts
{
  questions: Array<{
    id: string;
    label?: string;
    prompt: string;
    selectionMode?: 'single' | 'multiple';
    options: Array<{
      value: string;
      label: string;
      description?: string;
    }>;
    allowOther?: boolean; // defaults to true at runtime
  }> // min 1, max 5
}
```

Validation includes:
- 1-5 question limit
- non-empty option lists
- duplicate question id rejection
- duplicate option value rejection per question

## Normalized output schema (summary)

```ts
{
  questions: NormalizedQuestion[];
  answers: Array<{
    questionId: string;
    questionLabel: string;
    selectedOptions: Array<{ value: string; label: string }>;
    otherText: string | null;
    wasOtherSelected: boolean;
  }>;
  cancelled: boolean;
}
```

`Other` answers are rendered explicitly as:

```text
Other: "GraphQL"
```

## Keyboard model

- `← / →`: switch tabs (question tabs + Review tab)
- `↑ / ↓`: move option cursor (question tab) or row cursor (Review tab)
- `Space`:
  - question tab: select/toggle option or enter Other input
  - review tab: jump to selected question for editing
- `r`: jump to Review tab
- `Esc` hierarchy:
  1. exit Other input mode
  2. from Review, go back to prior question tab
  3. from question tab outermost, cancel questionnaire
- `Enter`:
  - in Other editor: submit typed text
  - in Review: submit only when all required answers are valid

## Example tool call

```json
{
  "name": "questionnaire",
  "arguments": {
    "questions": [
      {
        "id": "scope",
        "label": "Scope",
        "prompt": "What is the project scope?",
        "selectionMode": "single",
        "options": [
          { "value": "low", "label": "Low" },
          { "value": "high", "label": "High" }
        ]
      },
      {
        "id": "priority",
        "label": "Priority",
        "prompt": "What priority should we assign?",
        "selectionMode": "single",
        "options": [
          { "value": "p0", "label": "P0" },
          { "value": "p1", "label": "P1" }
        ]
      }
    ]
  }
}
```

## Example result summaries

Completed (collapsed):

```text
✓ Scope: High • Priority: P1 • Approach: Other: "GraphQL"
```

Cancelled:

```text
⚠ Cancelled
```

## Cancellation and non-interactive behavior

- User cancellation is **not treated as an error** (`cancelled: true` in details).
- Non-interactive mode (`!ctx.hasUI`) returns an immediate error result (`isError: true`).

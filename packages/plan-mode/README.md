# @dreki-gg/pi-plan-mode

Two-phase planning workflow for [pi](https://github.com/badlogic/pi-mono).

Plan with `claude-opus-4-6:medium`, execute with `gpt-5.5:low`. Plans are persisted as files in `.plans/` for clean context handoff between models.

## Install

```bash
pi install npm:@dreki-gg/pi-plan-mode
```

Recommended companions:

```bash
pi install npm:@dreki-gg/pi-questionnaire
```

## What it provides

| Feature  | Name           | Notes                                          |
| -------- | -------------- | ---------------------------------------------- |
| Flag     | `--plan`       | Start pi in plan mode                          |
| Command  | `/plan [prompt]` | Enter plan mode, optionally with a starting prompt |
| Command  | `/todos`       | Show current plan progress                     |
| Shortcut | `Ctrl+Alt+P`   | Toggle plan mode                               |

## Workflow

### 1. Plan (`claude-opus-4-6:medium`)

```text
/plan add authentication middleware with JWT support
```

The planner has access to read-only tools plus `edit`/`write` restricted to `.plans/` files. Bash is locked to a strict allowlist of safe commands.

The planner:
- Inspects the codebase using read-only tools
- Uses `questionnaire` when requirements are underspecified
- Creates `.plans/<kebab-name>/PLAN.md` with the full numbered plan
- Creates `.plans/<kebab-name>/START-PROMPT.md` — a self-contained handoff prompt with all context needed to execute without the planning conversation
- Can add supporting files in the same directory for extra context

### 2. Choose next step

When the planner finishes, a menu appears:

| Option           | Description                                                            |
| ---------------- | ---------------------------------------------------------------------- |
| **Execute Plan** | Extract todos from PLAN.md, switch to gpt-5.5:low, start with START-PROMPT.md |
| **Refine Plan**  | Adversarial review — planner critiques its own plan and updates files  |
| **Follow up**    | Open an editor for additional instructions to the planner              |
| **Exit plan mode** | Disable plan mode and restore original model                        |

### 3. Execute (`gpt-5.5:low`)

When **Execute Plan** is selected:
1. Todos are extracted from `PLAN.md`
2. Model switches to `gpt-5.5:low` with full tool access
3. The executor starts with a **clean context window** using `START-PROMPT.md`
4. Each step must be marked with `[DONE:n]` before moving to the next
5. Progress is tracked in a widget in the status bar
6. When all steps complete, the original model and thinking level are restored

## Plan directory structure

```
.plans/
├── plans.json                # Tracking manifest — plan status lifecycle
└── add-auth-middleware/
    ├── PLAN.md               # Numbered plan with context
    ├── START-PROMPT.md       # Self-contained executor handoff prompt
    └── ...                   # Optional supporting files
```

### plans.json

The extension automatically maintains `.plans/plans.json` to track plan lifecycle:

```json
{
  "add-auth-middleware": {
    "status": "in-progress",
    "title": "Add Authentication Middleware with JWT Support",
    "created": "2026-05-08T12:00:00.000Z",
    "completed": null
  },
  "fix-ci-flakes": {
    "status": "done",
    "title": "Fix CI Flaky Tests",
    "created": "2026-05-07T10:00:00.000Z",
    "completed": "2026-05-07T14:30:00.000Z"
  }
}
```

Plans start as `"in-progress"` when created and are marked `"done"` when all execution steps complete. This prevents accidental deletion of in-flight plans.

## Cleaning completed plans

Use the CLI to remove completed plan directories:

```bash
# Preview what would be deleted
npx @dreki-gg/pi-plan-mode clean --dry-run

# Delete completed plans and update plans.json
npx @dreki-gg/pi-plan-mode clean
```

In-flight plans (`"status": "in-progress"`) are never touched.

### GitHub Actions

Clean done plans automatically after merge — similar to changesets:

```yaml
name: Clean Plans

on:
  push:
    branches: [main]
    paths: ['.plans/**']

jobs:
  clean:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - run: npx @dreki-gg/pi-plan-mode clean
      - name: Commit cleanup
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .plans/
          git diff --cached --quiet || git commit -m "chore: clean completed plans"
          git push
```

### Should you gitignore `.plans/`?

**No.** Commit your plans — they provide decision history and execution context. Use the `clean` CLI to remove done plans after merge, keeping the directory lean. Plans are execution blueprints, not permanent documentation; for lasting decisions, use ADRs.

## Footer indicators

- `📝 plan` — plan mode active (opus-4-6:medium, strict bash)
- `📋 exec 2/5` — executing plan with gpt-5.5:low, 2 of 5 steps done

## Bash safety

In plan mode, bash is restricted to read-only commands (ls, grep, git status, cat, rg, etc.). Destructive commands (rm, mv, git commit, etc.) are blocked.

## Model Configuration

By default, the extension uses these models:
- **Planning**: `claude-opus-4-6:medium`
- **Execution**: `gpt-5.5:low`

You can customize these via a configuration file.

### Config file locations

| Scope | Path | Priority |
|-------|------|----------|
| Project | `.plans/plan-mode-config.json` | Highest |
| Global | `~/.pi/agent/plan-mode-config.json` | Lower |

Project config is merged with global config, which is merged with built-in defaults.

### Config options

```jsonc
{
  // Model for the planning phase
  "planModel": {
    "provider": "anthropic",
    "id": "claude-opus-4-6"
  },
  // Thinking level for planning (off/minimal/low/medium/high/xhigh)
  "planThinking": "medium",
  
  // Default model for execution phase
  "execModel": {
    "provider": "openai",
    "id": "gpt-5.5"
  },
  // Thinking level for execution
  "execThinking": "low",
  
  // Available models in the execution model picker
  "execModelOptions": [
    {
      "label": "gpt-5.5",
      "model": { "provider": "openai", "id": "gpt-5.5" }
    },
    {
      "label": "claude-opus-4-6",
      "model": { "provider": "anthropic", "id": "claude-opus-4-6" }
    }
  ]
}
```

All fields are optional — omitted fields use the built-in defaults.

### Example: Use Sonnet for planning

```json
{
  "planModel": {
    "provider": "anthropic",
    "id": "claude-sonnet-4-6"
  }
}
```

### Example: Add more execution model options

```json
{
  "execModelOptions": [
    { "label": "gpt-5.5", "model": { "provider": "openai", "id": "gpt-5.5" } },
    { "label": "claude-opus-4-6", "model": { "provider": "anthropic", "id": "claude-opus-4-6" } },
    { "label": "claude-sonnet-4-6", "model": { "provider": "anthropic", "id": "claude-sonnet-4-6" } },
    { "label": "gemini-2.5-pro", "model": { "provider": "google", "id": "gemini-2.5-pro" } }
  ]
}
```

## CLI reference

```
pi-plan-mode clean [--dry-run]
```

| Option      | Description                                      |
| ----------- | ------------------------------------------------ |
| `clean`     | Remove completed plan directories, update manifest |
| `--dry-run` | Show what would be deleted without deleting      |

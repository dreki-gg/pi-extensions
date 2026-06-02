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
| Command  | `/plan resume` | Pick up an in-progress plan from disk          |
| Command  | `/plan focus <name>` | Pin a plan so tracking calls default to it (multi-plan repos) |
| Command  | `/todos`       | Show current plan progress                     |
| Shortcut | `Ctrl+Alt+P`   | Toggle plan mode                               |
| Tool     | `update_task`  | Mark a task done / skipped / blocked           |
| Tool     | `add_task`     | Capture a discovered follow-up (deferred)      |
| Tool     | `plan_status`  | Read-only snapshot; progress table when many plans are active |
| Tool     | `update_plan`  | Close/reopen a plan: done, superseded, abandoned, in-progress |
| Tool     | `reconcile_plans` | Detect & repair drift between tasks.jsonl and the registry |

### Plan lifecycle status

The registry (`.plans/plans.jsonl`) `status` is a **projection of task state**, not a
hand-maintained flag. Marking every task `done`/`skipped` (via `update_task`, in any
session or model) automatically flips the plan to `done` — completion is no longer
coupled to a formal in-session execution run.

| Status        | Meaning                                            | Active? |
| ------------- | -------------------------------------------------- | ------- |
| `in-progress` | Active, tracked, eligible for auto-resolution      | ✅      |
| `done`        | All tasks resolved                                 | —       |
| `superseded`  | Another plan absorbed the work                     | —       |
| `abandoned`   | Won't do / rejected                                | —       |

`superseded` / `abandoned` are set explicitly via `update_plan` (with a `reason`) and are
never auto-overridden by task reconciliation. Only `in-progress` plans participate in
active-plan resolution.

In repos with **many** in-progress plans, an explicit `{ plan: "<name>" }` on
`update_task` / `add_task` / `plan_status` **always** targets that plan — it is never
silently overridden by whatever plan was last submitted in the session.

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

Use the CLI to clean closed plans (`done` / `superseded` / `abandoned`). By default it
**archives** plan directories to `.plans/.archive/<name>/` — keeping HANDOFF.md and
tasks.jsonl as a record — rather than deleting them:

```bash
# Preview what would be cleaned (no changes)
npx @dreki-gg/pi-plan-mode clean --dry-run

# Archive closed plans to .plans/.archive/ and update plans.jsonl
npx @dreki-gg/pi-plan-mode clean

# Permanently delete instead of archiving
npx @dreki-gg/pi-plan-mode clean --purge
```

In-flight plans (`"status": "in-progress"`) are never touched. Archiving is the default so
that closing out a finished plan never silently destroys its handoff + task ledger.

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

## CLI reference

```
pi-plan-mode clean [--dry-run] [--purge]
```

| Option      | Description                                                        |
| ----------- | ----------------------------------------------------------------- |
| `clean`     | Archive closed plan directories to `.plans/.archive/`, update manifest |
| `--dry-run` | Show what would be cleaned without changing anything              |
| `--purge`   | Permanently delete instead of archiving                           |

# @dreki-gg/pi-plan-mode

Cursor-like planning workflow for [pi](https://github.com/badlogic/pi-mono).

It gives pi a dedicated **plan mode** that:
- locks the agent into a read-only planning pass
- nudges it to use `questionnaire` before planning when scope is unclear
- hands off to `/skill:domain-model` when you want terminology/design pressure-testing
- hands off to `/skill:create-implementation-plans` when you want self-contained `*.plan.md` files
- restores full tool access for execution once the plan is approved

## Install

```bash
pi install npm:@dreki-gg/pi-plan-mode
```

Recommended companions:

```bash
pi install npm:@dreki-gg/pi-questionnaire
```

And make sure these skills are available globally or project-locally if you want the full workflow:
- `domain-model`
- `create-implementation-plans`

If those skills are missing, the extension falls back to plain prompts that emulate the same workflow.

## What it provides

| Feature | Name | Notes |
|---|---|---|
| Flag | `--plan` | Start pi in read-only planning mode |
| Command | `/plan [prompt]` | Enable plan mode or immediately send a planning prompt |
| Command | `/plan-status` | Show current phase + extracted plan steps |
| Command | `/plan-domain [prompt]` | Stress-test the current plan against the domain model |
| Command | `/plan-plans [prompt]` | Generate self-contained implementation plan files |
| Command | `/plan-execute [prompt]` | Restore full tool access and execute the approved plan |
| Shortcut | `Ctrl+Alt+P` | Toggle plan mode |

## Workflow

### 1. Start planning

```text
/plan add a plan mode similar to Cursor for this repo
```

While planning, the extension restricts tools to a read-only set such as:
- `read`
- `bash` (allowlisted read-only commands only)
- `grep`
- `find`
- `ls`
- `questionnaire` (if installed)
- `lsp` / `context7_*` (if installed)

The system prompt tells pi to:
- inspect the real codebase first
- use `questionnaire` when the task is still underspecified
- respond with a numbered plan under a `Plan:` header
- stay read-only

### 2. Stress-test the design

```text
/plan-domain
```

If `domain-model` is installed, the extension invokes:

```text
/skill:domain-model
```

Otherwise it sends an equivalent fallback prompt.

### 3. Write implementation plan files

```text
/plan-plans
```

This temporarily enables `edit`/`write`, but only for plan-file authoring. The prompt explicitly forbids product-code changes in this phase.

If `create-implementation-plans` is installed, the extension invokes:

```text
/skill:create-implementation-plans
```

Otherwise it falls back to a plain prompt that asks pi to create grounded `*.plan.md` files.

### 4. Execute

```text
/plan-execute
```

That restores the original tool set and asks pi to execute the approved plan. If the plan has numbered steps, the extension tracks progress via `[DONE:n]` tags.

## Notes

- Planning mode is **hard enforced** by tool restriction, not just prompt wording.
- `bash` is restricted to read-only commands while planning.
- Plan steps are extracted from `Plan:` sections and shown in a widget/status area.
- State is persisted across session resume and tree navigation.
- The implementation-plan phase is a **controlled write phase** intended for planning docs, not code changes.

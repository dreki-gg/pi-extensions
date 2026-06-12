# @dreki-gg/pi-stacked-prs

Stacked pull/merge request workflow for [pi](https://github.com/earendil-works/pi-coding-agent).

A **stack** is a chain of PRs where each one targets the branch of the PR below
it, ultimately landing on trunk. Stacks keep each diff small and let you keep
building while lower layers are still in review — ideal when an agent generates
a large, multi-subsystem change.

This package is a thin, agent-first workflow layer on top of the
[`@kitlangton/stack`](https://github.com/kitlangton/stack) CLI. It does **not**
reimplement stack mechanics — `stack` already handles inference, squash-safe
repair, retargeting, description blocks, and undo. This package adds:

- A **skill** that teaches the agent when and how to stack.
- Guarded **`/stack` commands** inside pi.

## Prerequisites

```bash
npm install -g @kitlangton/stack   # the stacking CLI
gh auth login                      # GitHub  (or: glab auth login for GitLab)
```

For enterprise hosts: `git config stack.codeHost github` (or `gitlab`).

The commands check this toolchain automatically and tell you what is missing.

## Commands

| Command | What it does |
|---|---|
| `/stack status` | Render the current stack as a tree (branch → PR# per layer). |
| `/stack split` | Analyze working changes, propose an ordered layered split, and — after you confirm — create the branch chain and publish via `stack sync --apply`. |
| `/stack sync` | Preview `stack sync`, confirm, then apply maintenance/repair. |
| `/stack merge` | Preview `stack merge`, confirm, then merge the root and repair descendants. |

All mutating commands **preview first and require confirmation** before applying.
`/stack split` proposes a split and never executes without your approval.

## How splitting works

`/stack split` groups your uncommitted changes into ordered layers
(schema → backend → API → frontend → tests), foundational first so lower layers
are safe to land ahead of higher ones. After you confirm, it creates a branch
per layer chained off the previous one, commits each layer, then runs
`stack sync --apply` to record and publish the stack.

Refine the proposal so each layer stays independently compilable and reviewable.

## Skill

The bundled `stacked-prs` skill encodes the heuristics (when to stack), the
happy path, and the recovery playbook (`stack doctor` / `history` / `undo`).
The agent loads it automatically when stacking work is relevant.

## License

MIT

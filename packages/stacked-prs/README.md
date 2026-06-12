# @dreki-gg/pi-stacked-prs

Stacked pull request workflow for [pi](https://github.com/earendil-works/pi-coding-agent).

A **stack** is a chain of PRs where each one targets the branch of the PR below
it, ultimately landing on trunk. Stacks keep each diff small and let you keep
building while lower layers are still in review — ideal when an agent generates
a large, multi-subsystem change.

This package is **fully self-contained**: a stacking engine bundled in the
extension that shells out only to `git` and the GitHub CLI (`gh`). No external
stacking CLI is required. **GitHub only.**

It provides:

- A **skill** that teaches the agent when and how to stack.
- Guarded **`/stack` commands** inside pi.

## Prerequisites

```bash
gh auth login   # GitHub CLI, authenticated
```

`git` is assumed available inside a repo. The commands check `gh` automatically
and tell you what is missing.

## Commands

| Command | What it does |
|---|---|
| `/stack status` | Render the current stack as a tree (branch → PR# per layer). |
| `/stack split` | Analyze working changes, propose an ordered layered split, and — after you confirm — create + push the branch chain, open a PR per layer, and record the stack. |
| `/stack sync` | Preview maintenance, confirm, then repair merged branches and refresh PR stack blocks. |
| `/stack merge` | Preview, confirm, then merge the root PR and repair descendants. |
| `/stack undo` | Preview, confirm, then restore branch tips and PR bases from the undo journal. |

All mutating commands **preview first and require confirmation** before applying.
`/stack split` proposes a split and never executes without your approval.

## How it works

- **State** is recorded under `<git-dir>/pi-stack/state.json` (stacks, PR numbers,
  parent links, last-known branch tips).
- **Inference** reads each open PR's base branch via `gh` to reconstruct the
  stack graph.
- **Squash-merge repair**: when a parent PR is squash-merged and its branch
  deleted, the engine retargets the child PR to trunk and rebases it off the
  remembered tip — then cascades to deeper descendants.
- **Safety**: every mutation snapshots branch tips + PR bases to
  `<git-dir>/pi-stack/undo.json` first. On a rebase conflict the engine aborts
  and rolls back automatically (never auto-resolves); fix the conflict and re-run.

## How splitting works

`/stack split` groups your uncommitted changes into ordered layers
(schema → backend → API → frontend → tests), foundational first so lower layers
are safe to land ahead of higher ones. After you confirm, it creates a branch
per layer chained off the previous one, commits + pushes each, opens a PR per
layer (root→trunk, child→parent), then records the stack.

Refine the proposal so each layer stays independently compilable and reviewable.

## Skill

The bundled `stacked-prs` skill encodes the heuristics (when to stack), the
happy path, and the recovery playbook (`/stack undo`). The agent loads it
automatically when stacking work is relevant.

## License

MIT

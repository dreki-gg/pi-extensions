---
name: stacked-prs
description: >-
  Manage stacked GitHub pull requests with a self-contained git + gh engine. Use
  when a change is large or spans multiple subsystems and should be split into a
  chain of small, independently reviewable PRs, or when maintaining / merging /
  repairing an existing stack after squash-merges. Triggers on "stack this",
  "stacked PRs", "split this PR", "split into a stack", or /stack commands.
---

# Stacked PRs

A **stack** is a chain of PRs where each PR targets the branch of the PR below
it, ultimately landing on trunk (`main`/`dev`). Stacks let you keep building
while lower layers are still in review, and keep each diff small and focused.

This is powered by a **self-contained engine** bundled in the extension — it
shells out only to `git` and the GitHub CLI (`gh`). No external stacking CLI is
required. The engine handles inference, repair after squash-merges, retargeting,
PR description blocks, and undo. **GitHub only.**

## When to stack

Recommend a stack when **any** holds:
- Diff is roughly **> 400 lines** AND touches **2+ subsystems**.
- Change spans **3+ natural layers** (schema → backend → API → frontend → tests).
- A later change depends on an earlier one that is itself worth reviewing alone.

Do **not** stack a small, single-subsystem change — one PR is simpler.

Good layer boundaries, ordered so lower layers can land first:
1. Schema / migrations / generated types
2. Backend / domain logic / services
3. API surface (routes, endpoints, controllers)
4. Frontend (components, pages, client)
5. Tests & docs

## Prerequisites

- `git` (assumed present inside a repo)
- GitHub CLI authenticated: `gh auth login`

The `/stack` commands check `gh` automatically and tell you what is missing.

## Happy path

1. Create stacked changes using normal git branches — each layer branches off
   the previous one.
2. Open the **root** PR/MR against trunk (`main`/`dev`).
3. Open each **child** PR/MR against **its parent branch**.
4. Preview + apply maintenance with `/stack sync` (always previews first).
5. Merge from the root with `/stack merge` when ready.

State is recorded under `<git-dir>/pi-stack/state.json`; an undo journal is saved
to `<git-dir>/pi-stack/undo.json` before every mutation.

In pi, prefer the guarded commands which always preview before applying:
- `/stack split` — analyze working changes, propose a layered split, and (after
  you confirm) create + push the branch chain, open a PR per layer, and record
  the stack.
- `/stack status` — render the current stack tree.
- `/stack sync` — preview then apply stack maintenance (repair + refresh blocks).
- `/stack merge` — preview then merge the root and repair descendants.
- `/stack undo` — preview then restore branch tips and PR bases from the journal.

## Splitting an existing big diff into a stack

1. Run `/stack split`: group changed files into ordered layers, foundational
   first, confirm, and let it build the stack.
2. Manual equivalent: for each layer in order `git checkout -b <layer> <parent>`,
   stage only that layer's files, commit, push, and open a PR (root→trunk,
   child→parent). Then `/stack sync` to record and refresh.

When refining the auto-proposal, keep each layer **independently compilable and
reviewable** — never split a function from its only caller across a boundary if
the lower layer would not build.

## Maintenance & recovery

- `/stack sync` is the routine maintenance command after any parent moves or
  lands — it repairs descendants and retargets PRs.
- `/stack undo` — restore branch tips and PR bases from the journal if a repair
  went wrong. Every mutation saves the undo journal first, so undo is safe.
- After a squash-merge that deletes a branch, run `/stack sync` to repair the
  rest of the stack rather than rebasing by hand.

## How repair stays safe

- Before any mutation the engine **snapshots** branch tips + PR bases. The
  remembered tip (`lastKnownTip`) is what lets a child rebase correctly after its
  parent branch is squash-merged and deleted.
- On a rebase conflict the engine **aborts and rolls back** automatically — it
  never attempts to auto-resolve. Resolve the conflict manually, then re-run.

## Safety rules

- **Always review the preview** the guarded commands print before confirming.
- **Do not force-push** branches by hand outside `/stack sync` — let the engine
  do rebases so descendants stay consistent.
- If a conflict halts a sync, the stack was rolled back; fix the conflict and
  re-run `/stack sync`.

## Commands (quick)

```
/stack status   render the current stack tree
/stack split    propose a layered split, then build + record the stack
/stack sync     preview then apply inference + repairs + description blocks
/stack merge    preview then merge the root and repair descendants
/stack undo     preview then restore branch tips and PR bases
```

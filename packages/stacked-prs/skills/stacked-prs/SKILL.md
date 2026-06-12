---
name: stacked-prs
description: >-
  Manage stacked pull/merge requests with the @kitlangton/stack CLI. Use when a
  change is large or spans multiple subsystems and should be split into a chain
  of small, independently reviewable PRs, or when maintaining/merging/repairing
  an existing stack after squash-merges. Triggers on "stack this", "stacked
  PRs", "split this PR", "split into a stack", or /stack commands.
---

# Stacked PRs

A **stack** is a chain of PRs where each PR targets the branch of the PR below
it, ultimately landing on trunk (`main`/`dev`). Stacks let you keep building
while lower layers are still in review, and keep each diff small and focused.

This skill wraps the agent-first **`@kitlangton/stack`** CLI. You do normal code
work with plain `git`; `stack` handles inference, repair after squash-merges,
retargeting, description blocks, and undo.

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

- `stack` CLI installed: `npm install -g @kitlangton/stack`
- A host CLI authenticated: `gh auth login` (GitHub) or `glab auth login` (GitLab)
- Enterprise hosts: `git config stack.codeHost github` (or `gitlab`)

The `/stack` commands check this automatically and tell you what is missing.

## Happy path

1. Create stacked changes using normal git branches — each layer branches off
   the previous one.
2. Open the **root** PR/MR against trunk (`main`/`dev`).
3. Open each **child** PR/MR against **its parent branch**.
4. Preview: `stack sync` → review the inferred tree and planned repairs.
5. Apply: `stack sync --apply` → records stack intent in
   `.git/stack/state.json`, retargets PRs, refreshes stack blocks.
6. Merge from the root when ready: `stack merge` (dry-run) → `stack merge --apply`.
   Use `stack merge --auto` to let the host wait for merge requirements, then
   repair descendants automatically after the root lands.

In pi, prefer the guarded commands which always preview before applying:
- `/stack split` — analyze working changes, propose a layered split, and (after
  you confirm) create the branch chain and run `stack sync --apply`.
- `/stack status` — render the current stack tree.
- `/stack sync` — preview then apply stack maintenance.
- `/stack merge` — preview then merge the root and repair descendants.

## Splitting an existing big diff into a stack

1. Run `/stack split` (or do it manually): group changed files into ordered
   layers, foundational first.
2. For each layer in order: `git checkout -b <layer> <parent>`, stage only that
   layer's files, commit. The first layer branches off trunk; each next layer
   branches off the previous.
3. Push branches and open PRs (root→trunk, child→parent), or let
   `stack sync --apply` open/retarget them.
4. `stack sync --apply` to record and publish the stack.

When refining the auto-proposal, keep each layer **independently compilable and
reviewable** — never split a function from its only caller across a boundary if
the lower layer would not build.

## Maintenance & recovery

- `stack sync --apply` is the routine maintenance command after any parent moves
  or lands — it repairs descendants and retargets PRs.
- `stack doctor` — inspect repo, host, metadata, and journal health.
- `stack history` — show the last saved mutation journal.
- `stack undo` → `stack undo --apply` — restore branch tips, PR targets, and
  metadata if a repair went wrong. Every mutation saves `.git/stack/undo.json`
  first, so undo is safe.
- `stack sync --apply --keep-going` — process independent stacks and report
  failures instead of stopping at the first.

## Safety rules

- **Always preview before `--apply`.** Never run a mutating stack command blind.
- **Do not force-push** branches outside the stack repair flow — let
  `stack sync` do rebases so descendants stay consistent.
- After a squash-merge that deletes a branch, run `stack sync --apply` to repair
  the rest of the stack rather than rebasing by hand.
- If anything looks wrong, stop and run `stack doctor` / `stack history` before
  mutating further.

## CLI reference (quick)

```
stack status                  inspect the relevant local stack
stack guide                   print the agent/human happy path
stack sync [--apply] [branch] preview / apply inference + repairs
stack sync --apply --keep-going  process independent stacks, report failures
stack doctor                  health check
stack merge [--apply|--auto]  dry-run / merge root + repair descendants
stack merge --auto --through <branch-or-change>  bounded auto-merge
stack history                 last mutation journal
stack undo [--apply]          preview / restore previous state
```

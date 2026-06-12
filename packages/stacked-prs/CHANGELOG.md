# @dreki-gg/pi-stacked-prs

## 1.0.0

### Major Changes

- Replace the external `@kitlangton/stack` CLI dependency with a self-contained
  stacking engine bundled in the extension. The engine shells out only to `git`
  and the GitHub CLI (`gh`) — no separate global install is required.

  **Breaking:** GitLab support is dropped (GitHub only), and the
  `npm install -g @kitlangton/stack` prerequisite is gone; only `gh auth login` is
  needed. State now lives at `<git-dir>/pi-stack/state.json` with an undo journal
  at `<git-dir>/pi-stack/undo.json`.

  The engine infers stacks from PR base branches, performs squash-merge repair
  (retarget child to trunk + rebase off the remembered tip, then cascade),
  refreshes PR description blocks, and snapshots before every mutation so a rebase
  conflict aborts and rolls back automatically. Adds a new `/stack undo` command;
  `/stack split` now pushes each layer and opens a PR per layer via `gh`.

## 0.2.0

### Minor Changes

- Introduce `@dreki-gg/pi-stacked-prs`: a stacked pull/merge request workflow for
  pi built on the `@kitlangton/stack` CLI. Ships a `stacked-prs` skill (when/how to
  stack, happy path, recovery) and `/stack` commands — `status` (render the stack
  tree), `split` (propose an ordered layered split, then create the branch chain
  and publish on confirm), and guarded `sync` / `merge` wrappers that always
  preview before applying.

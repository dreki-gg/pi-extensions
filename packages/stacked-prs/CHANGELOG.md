# @dreki-gg/pi-stacked-prs

## 0.2.0

### Minor Changes

- Introduce `@dreki-gg/pi-stacked-prs`: a stacked pull/merge request workflow for
  pi built on the `@kitlangton/stack` CLI. Ships a `stacked-prs` skill (when/how to
  stack, happy path, recovery) and `/stack` commands — `status` (render the stack
  tree), `split` (propose an ordered layered split, then create the branch chain
  and publish on confirm), and guarded `sync` / `merge` wrappers that always
  preview before applying.

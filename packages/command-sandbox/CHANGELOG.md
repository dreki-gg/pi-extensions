# @dreki-gg/pi-command-sandbox

## 0.2.1

### Patch Changes

- Fix stderr redirects to /dev/null (e.g. `2>/dev/null`) being incorrectly blocked as dangerous redirects. Only stdout redirects (`>`, `>>`) are now flagged.

## 0.2.0

### Minor Changes

- Make package public — no longer private, published to registry as a standalone dependency.

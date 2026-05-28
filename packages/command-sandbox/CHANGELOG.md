# @dreki-gg/pi-command-sandbox

## 0.3.0

### Minor Changes

- Add safe patterns for help, version, and man commands (--help, -h, --version, -v/-V, man, help, info) so sandboxed modes can explore CLI options without being blocked.

## 0.2.1

### Patch Changes

- Fix stderr redirects to /dev/null (e.g. `2>/dev/null`) being incorrectly blocked as dangerous redirects. Only stdout redirects (`>`, `>>`) are now flagged.

## 0.2.0

### Minor Changes

- Make package public — no longer private, published to registry as a standalone dependency.

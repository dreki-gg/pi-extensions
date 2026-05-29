# @dreki-gg/pi-pr-canvas

## 1.0.0

### Major Changes

- PR Canvas v2: Interactive SolidStart web application with Pi integration.

  - SolidStart app with SSR, file-based routing, dark theme
  - WebSocket bridge for real-time Pi ↔ Web UI communication
  - Effect v3: typed errors, Schema validation, service layers
  - @pierre/diffs for syntax-highlighted diff rendering
  - @pierre/trees for interactive file tree with git status
  - AI chat panel for asking questions about the PR
  - PR list dashboard + individual PR canvas view
  - Commands: /pr-canvas start|stop|open|status
  - 64 tests across 6 test files

## 0.3.0

### Minor Changes

- Integrate @pierre/diffs and @pierre/trees for rich PR canvas rendering. File diffs now use Pierre's syntax-highlighted diff viewer with split/unified toggle. File tree uses Pierre's interactive tree component with git status badges. Both loaded via CDN (jsdelivr).

## 0.2.1

### Patch Changes

- Fix gh CLI field name: use `reviewRequests` instead of `reviewers` which doesn't exist in gh pr view.

## 0.2.0

### Minor Changes

- Initial release of PR Canvas extension. Generates a self-contained HTML canvas for GitHub Pull Requests with 7 sections: overview, file tree, mind map, diff preview, CI checks, comments/reviews, and AI summary. Uses `gh` CLI for data fetching and heuristic analysis for semantic groupings.

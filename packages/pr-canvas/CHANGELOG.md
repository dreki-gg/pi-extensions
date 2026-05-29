# @dreki-gg/pi-pr-canvas

## 1.1.1

### Patch Changes

- Fix PR stuck on "Loading...": the initial pr:data request fired from onMount raced the WebSocket handshake and was silently dropped. The WS client now queues outgoing messages while connecting and flushes them on open. Also surface a "Can't reach the server" hint when the bridge is unreachable (instead of an endless spinner), normalize review timestamps (GitHub returns submittedAt for reviews), and remove the now-unused legacy GhClient adapter.

## 1.1.0

### Minor Changes

- UI refactor for usability: fix wasted layout column (chat no longer reserves 300px of grid space), add a sticky context bar that keeps PR title/state/stats/branch visible while scrolling, upgrade the sidebar with a consistent SVG icon set + at-a-glance triage badges (file count, failing-check count, comment count, AI concern count), prioritize failing CI checks at the top of the list, replace all emoji with a unified line-icon family, color PR labels by their GitHub hex, and add a reduced-motion fallback.

## 1.0.4

### Patch Changes

- Fix Pierre component initialization: use createEffect instead of onMount so components wait for data before mounting. Fix FileTree constructor to use `new FileTree({ paths }) + tree.render()` API. Fix CodeView to use `new CodeView(opts) + viewer.setup() + viewer.setItems()` API.

## 1.0.3

### Patch Changes

- Fix server start: set `noExternals: true` in Nitro config so vinxi runtime helpers are bundled into the output. The server build is now fully self-contained with no external dependencies required at runtime.

## 1.0.2

### Patch Changes

- Fix server start failure: include app/.output/public in published package (client JS/CSS assets were missing). Improve resolveAppDir with multiple resolution strategies and existence check. Better error messages showing resolved path.

## 1.0.1

### Patch Changes

- Cleanup: remove dead code (old command.ts), fix require() in ESM handler catch, remove unused imports.

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

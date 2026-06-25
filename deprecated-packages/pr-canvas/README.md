# @dreki-gg/pi-pr-canvas

Interactive GitHub Pull Request canvas for [pi](https://github.com/earendil-works/pi).

A local web application that gives you a complete mental model of any PR — with interactive diffs, file tree, Pi-model review synthesis with heuristic fallback, CI checks, comments, and an AI chat assistant. Powered by SolidStart, Effect, and Pierre.

## Prerequisites

- [GitHub CLI (`gh`)](https://cli.github.com/) installed and authenticated (`gh auth login`)
- Node.js 18+

## Installation

```bash
pi install @dreki-gg/pi-pr-canvas
```

## Usage

```
/pr-canvas start              # Start the server and open the dashboard
/pr-canvas stop               # Stop the server
/pr-canvas open [number]      # Open a specific PR or the dashboard
/pr-canvas status             # Show server status
```

The web UI runs at `http://localhost:3000` with a WebSocket bridge on port `3001`.

## Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────────┐
│   SolidStart    │ ◄─────────────────► │     Pi Extension     │
│   (Web UI)      │      Messages:      │    (ws-bridge.ts)    │
│  localhost:3000  │   pr:list/data      │                      │
│                 │   ai:chat           │  Uses:               │
│  • @pierre/diffs│   pr:subscribe      │  • pi.exec('gh')     │
│  • @pierre/trees│                     │  • Effect services   │
│  • AI Chat      │                     │  • Schema validation │
└─────────────────┘                     └──────────────────────┘
```

### How it works

1. `/pr-canvas start` launches a WebSocket bridge + SolidStart server
2. The web UI connects to Pi via WebSocket for all data
3. Pi fetches PR data using `gh` CLI and validates with Effect Schema
4. Diffs render via [@pierre/diffs](https://diffs.com/) with syntax highlighting
5. File tree renders via [@pierre/trees](https://trees.software/) with git status
6. AI review synthesis and chat use Pi's current model when available, with deterministic heuristics as a fallback

## Canvas Sections

| Section | Description |
|---------|-------------|
| **Overview** | Title, description, author, branch, state, labels, stats |
| **File Tree** | Interactive tree with git status badges (A/M/D/R) |
| **Mind Map** | Semantic grouping of changes (feature, refactor, fix, test, etc.) |
| **Diff Preview** | Syntax-highlighted diffs with split/unified toggle |
| **CI Checks** | Status of all CI checks (pass/fail/pending) |
| **Comments** | PR comments, reviews, and inline discussion threads |
| **Review Summary** | Pi-model synthesis when available, otherwise deterministic purpose, impact, highlights, hot-spots, and open questions |

## Tech Stack

- **[SolidStart](https://start.solidjs.com/)** — Fullstack framework (SSR + file-based routing)
- **[Effect](https://effect.website/)** v3 — Typed errors, Schema validation, service layers
- **[@pierre/diffs](https://diffs.com/)** — Diff rendering with Shiki syntax highlighting
- **[@pierre/trees](https://trees.software/)** — File tree with git status
- **WebSocket** — Real-time bridge between Pi and the web UI

## Development

```bash
# Run the SolidStart dev server (hot reload)
cd packages/pr-canvas && bun run dev

# Run tests
bun test

# Typecheck extension code
bun run typecheck

# Build for production
bun run build
```

## License

MIT

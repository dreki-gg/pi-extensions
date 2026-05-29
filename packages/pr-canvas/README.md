# @dreki-gg/pi-pr-canvas

Visual GitHub Pull Request canvas for [pi](https://github.com/earendil-works/pi).

Generate a self-contained HTML canvas that gives you a complete mental model of any PR — file tree, diffs, CI checks, comments, AI-powered mind map, and summary.

## Prerequisites

- [GitHub CLI (`gh`)](https://cli.github.com/) installed and authenticated (`gh auth login`)

## Installation

```bash
pi install @dreki-gg/pi-pr-canvas
```

## Usage

```
/pr-canvas <number|url>
```

Examples:
```
/pr-canvas 42
/pr-canvas https://github.com/org/repo/pull/42
```

## Canvas Sections

| Section | Description |
|---------|-------------|
| **Overview** | Title, description, author, branch, state, labels, stats |
| **File Tree** | Visual tree of modified files with change type badges and line counts |
| **Mind Map** | Semantic grouping of changes (feature, refactor, fix, test, etc.) |
| **Diff Preview** | Collapsible syntax-highlighted diffs per file |
| **CI Checks** | Status of all CI checks (pass/fail/pending) |
| **Comments** | PR comments, reviews, and inline discussion threads |
| **AI Summary** | Purpose, impact, highlights, and potential concerns |

## License

MIT

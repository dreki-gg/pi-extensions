# @dreki-gg/pi-miro

Create **native** Miro board items from pi — shapes, connectors, frames, and whole auto-laid-out diagrams. Turn a node/edge sketch (e.g. a Mermaid graph) into editable Miro objects instead of a flat pasted image.

## Install

```bash
pi install npm:@dreki-gg/pi-miro
```

## Setup

### 1. Access token

The extension uses a Miro OAuth access token, read from the `MIRO_ACCESS_TOKEN` environment variable (a project-root `.env` is also loaded; shell-exported vars win).

Create one from a Miro app with the `boards:read` and `boards:write` scopes, then:

```bash
export MIRO_ACCESS_TOKEN="..."
```

### 2. Project config (optional)

`.pi/miro.json` provides defaults so tools don't need a `boardId` every call:

```json
{
  "defaultBoardId": "uXjVABC123=",
  "defaultShape": "round_rectangle"
}
```

> The extension **never creates boards**. Every tool runs against an existing board, resolved from the explicit `boardId` argument or `defaultBoardId`. Run `miro_list_boards` to find a board id.

## Tools

| Tool | What it does |
|------|--------------|
| `miro_create_diagram` | Render a `nodes` + `edges` (+ optional `groups`) spec onto a board. Auto-layout via dagre, creates shapes + connectors + group frames. |
| `miro_create_shape` | Create a single shape at an absolute position. |
| `miro_create_connector` | Connect two existing items by id. |
| `miro_create_frame` | Create a titled frame (container region). |
| `miro_list_boards` | List boards accessible to the token (id, name, link). |

### Example: diagram

```jsonc
// miro_create_diagram
{
  "nodes": [
    { "id": "app", "label": "ViddyGo App" },
    { "id": "sdk", "label": "RUN.SDK" },
    { "id": "gen", "label": "Generation", "group": "platform" },
    { "id": "files", "label": "Files & Storage", "group": "platform" }
  ],
  "edges": [
    { "from": "app", "to": "sdk" },
    { "from": "sdk", "to": "gen" },
    { "from": "sdk", "to": "files" }
  ],
  "groups": [{ "id": "platform", "label": "RUN.platform" }],
  "direction": "LR"
}
```

Returns the created item counts and the board view link.

## How layout works

Nodes are laid out with [`@dagrejs/dagre`](https://github.com/dagrejs/dagre) (the layered-DAG engine Mermaid uses). Groups become dagre compound clusters, so their members stay together and the cluster bounds become a titled frame. dagre returns center coordinates, which match Miro's default position origin — no coordinate conversion.

## Notes

- Group frames are drawn first (behind nodes) as labeled regions; nodes are placed at absolute coordinates on top.
- Item creation runs through a small concurrency pool (4) to stay gentle on Miro rate limits.

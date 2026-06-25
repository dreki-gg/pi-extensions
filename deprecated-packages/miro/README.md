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
| `miro_create_diagram` | Render a `nodes` + `edges` (+ optional `groups`) spec onto a board. Auto-layout via dagre, creates shapes + connectors + group container regions. |
| `miro_create_shape` | Create a single shape at an absolute position. |
| `miro_create_connector` | Connect two existing items by id. |
| `miro_create_frame` | Create a titled frame (container region). |
| `miro_list_items` | List items on a board (id, type, label, position, size). Filter by type and/or parent frame. |
| `miro_update_item` | Edit an existing item (shape/text/sticky_note/frame): text, position, size, colors. |
| `miro_delete_items` | Delete one or more items by id (tolerates per-item failure). |
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

## Reading & editing a board

The extension is read/write, not just create-only. Because connectors and edits
need item ids that only exist on the board, the usual loop is:

1. `miro_list_items` to discover ids (optionally filtered by `type` or `frameId`).
2. `miro_update_item` to retext/recolor/move/resize an item, or `miro_create_connector` to wire two by id.
3. `miro_delete_items` to clean up.

`miro_update_item` supports `shape`, `text`, `sticky_note`, and `frame` items;
partial position/size edits merge over the item's current values, so moving one
axis keeps the other.

## How layout works

Nodes are laid out with [`@dagrejs/dagre`](https://github.com/dagrejs/dagre) (the layered-DAG engine Mermaid uses). Groups become dagre compound clusters, so their members stay together and the cluster bounds become a **container region**. dagre returns center coordinates, which match Miro's default position origin — no coordinate conversion.

## Why groups are container shapes, not frames

In Miro a **frame is an artboard**: any item positioned within it is auto-parented to the frame, so moving or deleting the frame drags its contents, frames can't nest, and overlapping frames fight over ownership. To group visually without that behavior, each group is drawn as a **backdrop shape** (a soft-tinted `round_rectangle`) plus a separate top-left **title text** — member nodes stay fully independent items.

The optional `frameTitle` outer wrap is still a real frame: one whole-diagram artboard that shows up in Miro's Frames panel for quick navigation.

## Notes

- Group containers (backdrop shape + title text) are drawn first, behind nodes; nodes are placed at absolute coordinates on top.
- Item creation runs through a small concurrency pool (4) to stay gentle on Miro rate limits.

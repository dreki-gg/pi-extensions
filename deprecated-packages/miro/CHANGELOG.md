# @dreki-gg/pi-miro

## 0.5.0

### Minor Changes

- Make diagram groups behave like real groupings and add board read/write tools.

  - **Groups render as container shapes, not frames.** Miro frames are artboards that auto-parent any item inside their bounds, so the old per-group frames captured member nodes (move/delete the frame, drag its contents; frames can't nest; overlapping group frames fought over ownership). Each group is now a soft-tinted backdrop `round_rectangle` plus a separate top-left title text — member nodes stay fully independent. The optional `frameTitle` outer wrap is still a real frame for Frames-panel navigation.
  - **New `miro_list_items`** — list items on a board (id, type, label, position, size), filterable by `type` and/or parent `frameId`. Discovering ids unblocks connecting, updating, and deleting existing items.
  - **New `miro_update_item`** — edit a `shape`/`text`/`sticky_note`/`frame`'s content, position, size, or colors. Partial position/size edits merge over the item's current values.
  - **New `miro_delete_items`** — delete one or more items by id, tolerating per-item failure.

## 0.4.0

### Minor Changes

- d4c03d6: Diagrams are now color-coded by group automatically. Each group gets a coordinated color from a curated palette — frame background, node fill/border, and the connectors originating in it — so the result reads organically instead of flat monochrome. Ungrouped nodes (entry points) render as dark chips. Add `colorize: false` to opt out, or set a per-node `style` (fillColor/borderColor/textColor) to override the theme. `miro_create_shape`/`miro_create_connector`/`miro_create_frame` gained the underlying color support too.

## 0.3.0

### Minor Changes

- 30e5466: `miro_create_diagram` gains an optional `frameTitle` — when set, the whole diagram is wrapped in a single titled outer frame so it's easy to find (appears in Miro's Frames panel) instead of free-floating at the canvas origin. The wrapping frame's bounds now include group frames, not just raw nodes, so groups never poke outside it.

## 0.2.0

### Minor Changes

- Add `@dreki-gg/pi-miro`: create native Miro board items from pi. Includes a high-level `miro_create_diagram` tool (declarative nodes/edges/groups, dagre auto-layout, shapes + connectors + frames) plus low-level primitives (`miro_create_shape`, `miro_create_connector`, `miro_create_frame`, `miro_list_boards`). Uses the official `@mirohq/miro-api` SDK with a `MIRO_ACCESS_TOKEN` and `.pi/miro.json` defaults; always operates on an existing board.

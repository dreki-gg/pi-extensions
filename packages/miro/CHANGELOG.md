# @dreki-gg/pi-miro

## 0.3.0

### Minor Changes

- 30e5466: `miro_create_diagram` gains an optional `frameTitle` — when set, the whole diagram is wrapped in a single titled outer frame so it's easy to find (appears in Miro's Frames panel) instead of free-floating at the canvas origin. The wrapping frame's bounds now include group frames, not just raw nodes, so groups never poke outside it.

## 0.2.0

### Minor Changes

- Add `@dreki-gg/pi-miro`: create native Miro board items from pi. Includes a high-level `miro_create_diagram` tool (declarative nodes/edges/groups, dagre auto-layout, shapes + connectors + frames) plus low-level primitives (`miro_create_shape`, `miro_create_connector`, `miro_create_frame`, `miro_list_boards`). Uses the official `@mirohq/miro-api` SDK with a `MIRO_ACCESS_TOKEN` and `.pi/miro.json` defaults; always operates on an existing board.

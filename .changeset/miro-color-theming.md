---
"@dreki-gg/pi-miro": minor
---

Diagrams are now color-coded by group automatically. Each group gets a coordinated color from a curated palette — frame background, node fill/border, and the connectors originating in it — so the result reads organically instead of flat monochrome. Ungrouped nodes (entry points) render as dark chips. Add `colorize: false` to opt out, or set a per-node `style` (fillColor/borderColor/textColor) to override the theme. `miro_create_shape`/`miro_create_connector`/`miro_create_frame` gained the underlying color support too.

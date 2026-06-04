---
"@dreki-gg/pi-miro": minor
---

`miro_create_diagram` gains an optional `frameTitle` — when set, the whole diagram is wrapped in a single titled outer frame so it's easy to find (appears in Miro's Frames panel) instead of free-floating at the canvas origin. The wrapping frame's bounds now include group frames, not just raw nodes, so groups never poke outside it.

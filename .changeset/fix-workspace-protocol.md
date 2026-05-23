---
"@dreki-gg/pi-plan-mode": patch
"@dreki-gg/pi-ask-mode": patch
---

fix(plan-mode, ask-mode): replace workspace:\* with actual version during prepack to fix npm install

The published packages contained `"workspace:*"` in their dependencies field, which npm doesn't understand (`EUNSUPPORTEDPROTOCOL`). The prepack script now rewrites `workspace:*` to the concrete version from command-sandbox's package.json before packing, and postpack restores it via `git checkout`.

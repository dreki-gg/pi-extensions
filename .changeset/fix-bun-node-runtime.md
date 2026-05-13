---
"@dreki-gg/pi-plan-mode": patch
---

fix(plan-mode): replace Bun-specific APIs with Node.js `fs/promises`

`pi` runs under Node.js (`#!/usr/bin/env node`), so `Bun.file()` and `Bun.write()` are unavailable at runtime. Replaced all usages with `readFile` and `writeFile` from `node:fs/promises`, which work in both runtimes.

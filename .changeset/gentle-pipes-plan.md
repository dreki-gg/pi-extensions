---
"@dreki-gg/pi-plan-mode": patch
---

fix(plan-mode): allow safe bash commands that were incorrectly blocked in plan mode

Three fixes to `isSafeCommand`:
- Allow `mkdir -p .plans/` since the planner needs to create plan directories
- Fix redirect pattern to not false-positive on stderr redirects like `2>/dev/null`
- Split piped commands and validate each segment independently, so `curl ... | grep ... | head` works correctly

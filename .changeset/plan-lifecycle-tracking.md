---
"@dreki-gg/pi-plan-mode": minor
---

Add plans.json lifecycle tracking and CLI for cleaning completed plans

- Extension now writes `.plans/plans.json` to track plan status (`in-progress` / `done`) with timestamps and titles
- Plans are recorded as `in-progress` when created, marked `done` when all execution steps complete
- New `pi-plan-mode clean` CLI (`npx @dreki-gg/pi-plan-mode clean [--dry-run]`) removes completed plan directories while preserving in-flight plans
- Cleanup step added to publish.yml workflow to auto-clean done plans on merge to main
- Removed stale `docs/plans/` from browser-tools and subagent packages

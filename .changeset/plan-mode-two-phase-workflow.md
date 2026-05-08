---
"@dreki-gg/pi-plan-mode": minor
---

Redesign plan mode as a two-phase workflow with file-based handoff

- Plan phase uses `claude-opus-4-6:medium` with read-only tools + strict bash allowlist
- Plans are written to `.plans/<kebab-name>/PLAN.md` with a `START-PROMPT.md` for clean context handoff
- Execute phase uses `gpt-5.5:low` with full tool access, starting from START-PROMPT.md in a clean context
- Todo extraction is deferred to execution time (extracted from PLAN.md on "Execute Plan")
- New menu: Execute Plan, Refine Plan (adversarial self-review), Follow up, Exit plan mode
- Model and thinking level are saved/restored across phase transitions
- Removed domain-model, plan-files, and autocomplete sub-workflows

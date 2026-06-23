---
"@dreki-gg/pi-code-reviewer": minor
---

Add a `--repo` flag (alias `--cwd`) to `/review` and a `cwd` parameter to the
`code_review` tool so reviews can target a git worktree or sibling repo without
leaving the session. The override is resolved relative to the session directory
and validated as a git work tree; `.code-review.json`, lenses, and recorded
rejections all resolve relative to it, while the session directory is left
unchanged.

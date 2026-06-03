---
'@dreki-gg/pi-plan-mode': minor
---

Add `update_tasks` batch tool: mark several plan tasks done/skipped in a single
call with one coalesced `tasks.jsonl` write (avoids the file-write contention
from repeated `update_task` calls). Each item is `{ task_id, status, notes? }`;
blocking stays single-task via `update_task`.

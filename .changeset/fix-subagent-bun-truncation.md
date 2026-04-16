---
'@dreki-gg/pi-subagent': patch
---

Fix two bugs in the `subagent` tool surfaced when spawning long-running reviewer agents:

- **Bun standalone binary spawn failure**: `getPiInvocation` now detects Bun's virtual filesystem paths (`/$bunfs/...`) in `process.argv[1]` and falls back to invoking the compiled binary directly. Previously, spawned subagents would fail with errors like `/$bunfs/root/pi doesn't exist in this environment` because the virtual path was passed verbatim to `spawn`.
- **Parallel summary truncation**: `parallel` mode no longer truncates each child agent's final output to 100 characters in the tool result summary. Long reviews from editorial/scout agents are now returned in full so callers don't need to scrape temp files or re-run agents to see their work.

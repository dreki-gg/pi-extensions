---
"@dreki-gg/pi-browser-tools": patch
---

Fix browser tools hanging indefinitely on Windows. The agent-browser CLI runner
now settles on the process `exit` event instead of `close`, so a persistent
browser daemon that inherits stdout/stderr handles (the default on Windows) no
longer keeps the call open forever. Every CLI invocation also gets a hard
timeout that turns a wedged browser into a clear, actionable error instead of a
frozen agent.

---
description: Worker implements, reviewer reviews, worker applies feedback
---
Use the subagent tool with the chain parameter to execute this workflow:

1. First, use the "worker" agent to implement: $@. Require the worker to return its standard compact review packet.
2. Then, use the "reviewer" agent to perform a diff-first review using {previous} only as a compact review packet (goal, exact files changed, key symbols, validation, constraints followed, open risks). The reviewer must start from `git diff` and re-discover repo context from code as needed.
3. Finally, use the "worker" agent to address only concrete Critical and Warning findings from {previous}. Ignore Suggestions unless they clearly fit scope and are low risk.

Execute this as a chain, passing output between steps via {previous}. The reviewer should privilege the diff and code over the packet, and the final worker pass should stay focused on actionable findings rather than broad rewrites.

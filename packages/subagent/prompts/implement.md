---
description: Full implementation workflow - scout gathers context, planner creates plan, worker implements
---
Use the subagent tool with the chain parameter to execute this workflow:

1. First, use the "scout" agent to find all code relevant to: $@
2. Then, use the "planner" agent to create an implementation plan for "$@" using the structured handoff from the previous step (use {previous} placeholder)
3. Finally, use the "worker" agent to implement the plan from the previous step using the structured handoff in {previous}

Execute this as a chain, passing output between steps via {previous}. The {previous} placeholder now contains a compact handoff with summary, files, decisions, and truncated raw output rather than an unbounded transcript dump.

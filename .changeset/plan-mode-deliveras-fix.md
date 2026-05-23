---
"@dreki-gg/pi-plan-mode": patch
---

fix(plan-mode): queue messages with deliverAs to prevent "agent already processing" errors

All `sendMessage` and `sendUserMessage` calls inside the `agent_end` handler now use `deliverAs: 'followUp'` so they are queued until the agent fully settles. Previously, "Follow up", "Refine Plan", and "Execute Plan" would fire while the agent was still in a processing state, causing silent failures or the error: "Agent is already processing. Specify streamingBehavior ('steer' or 'followUp') to queue the message."

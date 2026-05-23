---
"@dreki-gg/pi-plan-mode": patch
---

fix(plan-mode): use sendMessage with triggerTurn for Follow up action

sendUserMessage with deliverAs: 'followUp' only queues the message after the current turn, but inside agent_end there is no active turn — so the message sits in the queue forever. Switch to sendMessage with triggerTurn: true + deliverAs: 'followUp' to correctly queue and force a new turn.

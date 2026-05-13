---
"@dreki-gg/pi-questionnaire": patch
---

fix(questionnaire): remove `terminate: true` from successful tool result

The questionnaire tool was returning `terminate: true` on successful completion, which caused the agent's turn to end immediately after the user submitted answers. The agent never got to process the responses and continue working. Now the agent receives the answers and continues its turn normally.

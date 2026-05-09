---
"@dreki-gg/pi-questionnaire": patch
---

fix(questionnaire): prevent navigation keys from interrupting "Other" text input

When typing custom text in the "Other" input field, keys like Space, Left/Right arrows, and 'r' were intercepted by tab navigation handlers instead of being sent to the text editor. This caused accidental tab switches that cleared the input mode and lost any typed text.

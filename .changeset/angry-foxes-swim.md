---
"@dreki-gg/pi-subagent": patch
---

fix(subagent): resolve TDZ crash when onMessage/onToolResult callbacks fire before spawnResult is assigned

Previously, `runSingleAgent` declared `const spawnResult = await spawnPiAgent({...})` and referenced `spawnResult` inside the `onMessage`/`onToolResult` callbacks. Since callbacks fire during the await (before the const is assigned), this caused a `ReferenceError: Cannot access 'spawnResult' before initialization`. Now uses `let` with a guard to safely accumulate messages when the result is not yet available.

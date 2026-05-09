# Fix Questionnaire "Other" Input Mode Key Handling

## What to fix

The questionnaire extension's "Other" text input mode doesn't work properly — keys like Space, Left/Right arrows, and 'r' are intercepted by navigation handlers instead of being sent to the text editor.

## File to edit

`packages/questionnaire/extensions/questionnaire/ui.ts`

## The bug

In the `handleInput` function (~line 223), when `inputMode === 'otherInput'`, the key handling order is wrong. Left/Right arrow keys and 'r' are handled unconditionally before the `otherInput` delegation to the editor:

```js
function handleInput(data: string) {
  // Only Escape is guarded by otherInput check
  if (uiState.inputMode === 'otherInput' && matchesKey(data, Key.escape)) {
    clearInputMode();
    invalidate();
    return;
  }

  // These run UNCONDITIONALLY — even in otherInput mode!
  if (matchesKey(data, Key.left)) { switchTabs(-1); return; }
  if (matchesKey(data, Key.right)) { switchTabs(1); return; }
  if (isRKey(data)) { jumpToReview(); return; }

  // Editor only gets keys that survived the gauntlet above
  if (uiState.inputMode === 'otherInput') {
    editor.handleInput(data);
    invalidate();
    return;
  }
  // ...rest of handler
```

`switchTabs` and `jumpToReview` both call `clearInputMode()` which resets `inputMode` to `'navigate'` and clears `editingQuestionId`, losing the editor text.

## The fix

**Step 1.** Consolidate the `otherInput` handling into a single early-exit block at the top of `handleInput`. Replace:

```js
    function handleInput(data: string) {
      if (uiState.inputMode === 'otherInput' && matchesKey(data, Key.escape)) {
        clearInputMode();
        invalidate();
        return;
      }

      if (matchesKey(data, Key.left)) {
        switchTabs(-1);
        return;
      }

      if (matchesKey(data, Key.right)) {
        switchTabs(1);
        return;
      }

      if (isRKey(data)) {
        jumpToReview();
        return;
      }

      if (uiState.inputMode === 'otherInput') {
        editor.handleInput(data);
        invalidate();
        return;
      }
```

With:

```js
    function handleInput(data: string) {
      if (uiState.inputMode === 'otherInput') {
        if (matchesKey(data, Key.escape)) {
          clearInputMode();
          invalidate();
          return;
        }
        editor.handleInput(data);
        invalidate();
        return;
      }

      if (matchesKey(data, Key.left)) {
        switchTabs(-1);
        return;
      }

      if (matchesKey(data, Key.right)) {
        switchTabs(1);
        return;
      }

      if (isRKey(data)) {
        jumpToReview();
        return;
      }
```

This is the **only change needed**. The `otherInput` block becomes a single early-exit guard that captures ALL keys when in input mode (except Escape which exits). The navigation handlers below only run when `inputMode === 'navigate'`.

**Step 2.** Verify the build passes:
```bash
cd packages/questionnaire && npx tsc --noEmit
```

[DONE:1] after editing the file
[DONE:2] after verifying the build

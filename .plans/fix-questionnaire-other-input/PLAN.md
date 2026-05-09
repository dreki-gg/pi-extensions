# Fix Questionnaire "Other" Input Mode Key Handling

Fix the questionnaire extension so that when the user is typing custom "Other" text, all keys (including Space, arrow keys, and 'r') are properly delegated to the text editor instead of being intercepted by navigation handlers.

## Context

**File:** `packages/questionnaire/extensions/questionnaire/ui.ts`

The `handleInput` function (line ~223) has a key handling priority bug. When `inputMode === 'otherInput'` (user is typing custom text in the Editor), the function processes keys in this order:

1. Escape in otherInput → clears input mode ✓
2. **Left arrow → `switchTabs(-1)` (unconditional)** ← BUG
3. **Right arrow → `switchTabs(1)` (unconditional)** ← BUG  
4. **'r'/'R' → `jumpToReview()` (unconditional)** ← BUG
5. otherInput → delegates to editor ✓
6. Review/question-specific handlers

Steps 2-4 run regardless of input mode, which means:
- **Left/Right arrows** switch tabs and call `clearInputMode()`, destroying the editor state
- **'r'/'R'** jumps to review, also clearing input mode
- **Space** technically reaches the editor, but if the user accidentally triggered a tab switch first (losing input mode), Space in navigate mode triggers option selection instead

The `switchTabs` function calls `clearInputMode()`, which resets `inputMode` to `'navigate'` and clears `editingQuestionId`. The editor text is **never saved** to `selection.otherText` during this accidental exit — only `editor.onSubmit` (Enter key) saves it. So when the user navigates back and re-enters Other input, the text is gone.

## Plan:

1. **Move the `otherInput` delegation block above the unconditional navigation handlers** in the `handleInput` function (~line 223 of `ui.ts`).

   **Before:**
   ```js
   function handleInput(data: string) {
     if (uiState.inputMode === 'otherInput' && matchesKey(data, Key.escape)) {
       clearInputMode();
       invalidate();
       return;
     }
   
     if (matchesKey(data, Key.left)) { switchTabs(-1); return; }
     if (matchesKey(data, Key.right)) { switchTabs(1); return; }
     if (isRKey(data)) { jumpToReview(); return; }
   
     if (uiState.inputMode === 'otherInput') {
       editor.handleInput(data);
       invalidate();
       return;
     }
     // ...
   ```

   **After:**
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
   
     if (matchesKey(data, Key.left)) { switchTabs(-1); return; }
     if (matchesKey(data, Key.right)) { switchTabs(1); return; }
     if (isRKey(data)) { jumpToReview(); return; }
     // ... (remove the old otherInput block that was here)
     // ...
   ```

   This ensures that when in `otherInput` mode, **all keys except Escape** go to the editor. Space, arrows, 'r', etc. all work correctly for text editing.

2. **Verify no other code paths are affected.** The only change is the order of checks in `handleInput`. The review tab and question navigation handlers remain untouched and are only reachable when `inputMode === 'navigate'`.

## Risks / Open Questions

- **No tests exist** for the questionnaire UI (`find` returned no test files). Consider adding a test for this specific behavior, but it's not strictly required for the fix since the change is minimal and mechanical.
- **Escape is the only way out of otherInput mode** (besides Enter to submit). This is existing behavior and seems intentional — the hint text already says "Enter submits Other text • Esc exits input mode".

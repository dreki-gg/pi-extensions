# pi-extensions

pi-extensions is a collection of independently installable pi extension packages, each shipping focused behavior that can be adopted without changing pi core.

## Language

**Extension Package**:
An independently installable package in this monorepo that ships one or more pi extensions.
_Avoid_: example-only extension, core feature

**Modal Editor Extension**:
An extension that replaces pi's main input editor with mode-dependent behavior while keeping pi's in-editor features.
_Avoid_: vim support, vim mode, full vim

**Custom Editor**:
An editor component installed via `ctx.ui.setEditorComponent()` that takes over prompt editing inside pi.
_Avoid_: plugin editor, embedded editor hack

**Insert Mode**:
The editing mode that delegates input to pi's built-in editor behavior, including autocomplete and slash/file completions.
_Avoid_: normal typing mode

**Normal Mode**:
The editing mode that interprets printable keys as commands instead of text insertion.
_Avoid_: command mode

**Logical Line**:
A newline-delimited line in the prompt buffer, independent of how the terminal soft-wraps it on screen.
_Avoid_: visual line, wrapped line

## Relationships

- A **Modal Editor Extension** is shipped as an **Extension Package**
- A **Modal Editor Extension** installs a **Custom Editor**
- A **Custom Editor** can switch between **Insert Mode** and **Normal Mode**
- Vim-style deletion commands in the modal editor operate on **Logical Lines**, not terminal-wrapped display lines

## Example dialogue

> **Dev:** "I want vim-like editing, but I still need `@file` autocomplete."
> **Domain expert:** "Use a **Modal Editor Extension** so **Insert Mode** still delegates to the built-in editor."
>
> **Dev:** "Should `dd` follow the wrapped screen lines?"
> **Domain expert:** "No — it operates on a **Logical Line**, meaning the real newline-delimited line in the buffer."

## Flagged ambiguities

- "vim-like functionality" was used to mean both simple key remapping and a **Modal Editor Extension** — resolved: this plan targets a **Modal Editor Extension**.
- "selection/delete" was mentioned alongside vim motions, but pi's current editor model does not expose true visual selection — resolved: treat visual selection as a separate future feature, not part of this first implementation.
- Word motions and word deletions could have meant exact vim semantics or pi-native boundaries — resolved: use pi's existing word classification for `w`, `b`, `dw`, and `db`.
- Deletion motions could have crossed newlines — resolved: `dw` and `db` stay within the current **Logical Line** in v1.
- Delivery target could have been pi-mono examples or a reusable package — resolved: ship this as an **Extension Package** in `pi-extensions` only.

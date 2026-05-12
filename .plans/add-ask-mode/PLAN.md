# Add ask-mode Extension

A new `@dreki-gg/pi-ask-mode` pi-extension package that enforces a read-only "ask" mode — pi can only read files, search, and answer questions, with no ability to create, edit, or delete files. Simple toggle with `/ask`, no plan files, no end-of-turn prompts.

## Context

- **Monorepo**: `packages/*` workspace with auto-discovery via root `package.json`.
- **Extension pattern**: `packages/<name>/extensions/<name>/index.ts` entry, `package.json` with `"pi": { "extensions": [...] }`.
- **Reference**: `packages/plan-mode` has `isSafeCommand()` bash filtering in `utils.ts`. `packages/modes` has `session_tree` state restore pattern.
- **Built-in tools**: `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`. Others (`questionnaire`, `search_skills`) are extension-registered.
- **Theme colors**: `accent`, `success`, `error`, `warning`, `muted`, `dim`, `toolTitle`. No `'info'` color.
- **Key import**: `Key` from `@earendil-works/pi-tui` for shortcuts.

## Plan:

1. **Create `packages/ask-mode/package.json`** — `@dreki-gg/pi-ask-mode`, peerDeps on `pi-coding-agent` + `pi-tui`, pi entry `./extensions/ask-mode`

2. **Create `packages/ask-mode/tsconfig.json`** — same as `packages/modes/tsconfig.json`, tsBuildInfoFile `ask-mode.tsbuildinfo`

3. **Create `packages/ask-mode/extensions/ask-mode/utils.ts`** — port `isSafeCommand()` from plan-mode without the `.plans/ mkdir` exception

4. **Create `packages/ask-mode/extensions/ask-mode/index.ts`** — the extension:
   - `ASK_TOOLS = ['read', 'bash', 'grep', 'find', 'ls']`
   - `--ask` flag, `/ask` command (toggle), `Ctrl+Alt+A` shortcut
   - `tool_call`: block `edit`/`write`, block destructive bash
   - `before_agent_start`: inject read-only instructions (no `display`)
   - `context`: filter stale ask-mode messages when off
   - `session_start` / `session_tree`: restore state
   - Status indicator: `theme.fg('accent', '🔍 ask')` — that's it, no widgets
   - **NO `agent_end` handler** — no post-turn prompt/menu, user just keeps chatting
   - **NO `.plans/` file creation** — pure in-memory + persisted state
   - Save/restore `previousTools` on enter/exit

5. **Create `packages/ask-mode/README.md`**

6. **Run `bun install`** then **`bun run typecheck`**

## Risks / Open Questions

- **Coexistence with pi-modes**: Both call `setActiveTools()`. Save/restore on enter/exit handles this. Defense-in-depth `tool_call` handler catches edge cases.
- **Bash heuristics**: Regex-based. Ported from plan-mode's tested list.

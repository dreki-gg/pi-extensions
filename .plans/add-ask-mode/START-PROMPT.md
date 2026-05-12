# Execute: Add ask-mode Extension

Create `@dreki-gg/pi-ask-mode` — a read-only "ask" mode extension for pi.

**Behavior**: `/ask` toggles the mode. While active, only read-only tools work. No files are created. No end-of-turn menu/prompt — user keeps chatting freely until they `/ask` again to exit.

## Reference Files (read before implementing)

- `packages/plan-mode/extensions/plan-mode/utils.ts` — `isSafeCommand()`, `DESTRUCTIVE_PATTERNS`, `SAFE_PATTERNS`, `splitPipeSegments()`
- `packages/plan-mode/extensions/plan-mode/index.ts` — Extension structure: flags, commands, shortcuts, tool_call blocking, before_agent_start, context filtering, session_start restore, state persistence
- `packages/modes/extensions/modes/index.ts` — `session_tree` handler pattern for state restore after tree navigation
- `packages/modes/package.json` — Package.json template
- `packages/modes/tsconfig.json` — tsconfig template

## API Quick Reference

```typescript
// Types
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { Key } from '@earendil-works/pi-tui';

// Tool control
pi.setActiveTools(names: string[])    // Set active tool whitelist
pi.getActiveTools(): string[]         // Get current active tools

// Registration
pi.registerFlag(name, { description, type, default })
pi.registerCommand(name, { description, handler(args, ctx) })
pi.registerShortcut(Key.ctrlAlt('a'), { description, handler(ctx) })

// State
pi.appendEntry<T>(customType, data)   // Persist in session
pi.getFlag(name)                      // Read CLI flag
pi.sendUserMessage(text)              // Send as user

// Events — return values
// tool_call: { block: true, reason: string } to block
// before_agent_start: { message: { customType, content, display } }
// context: { messages: [...] }

// UI
ctx.ui.notify(msg, 'info'|'warning'|'error'|'success')
ctx.ui.setStatus(key, text | undefined)
ctx.ui.theme.fg(color, text)  // 'accent','success','error','warning','muted','dim'

// Session
ctx.sessionManager.getEntries()
ctx.sessionManager.getBranch?.() ?? ctx.sessionManager.getEntries()

// tool_call event.input typing
event.input.command as string
(event.input as { path?: string }).path
```

## Steps

### 1. Create `packages/ask-mode/package.json` [DONE:1]

```json
{
  "name": "@dreki-gg/pi-ask-mode",
  "version": "0.1.0",
  "description": "Read-only ask mode for pi — restricts tools to read-only operations, blocking file creation, editing, and deletion",
  "keywords": ["pi-package"],
  "author": "Juan Albarran <jalbarrandev@gmail.com>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/dreki-gg/pi-extensions",
    "directory": "packages/ask-mode"
  },
  "type": "module",
  "files": ["extensions", "README.md", "CHANGELOG.md", "package.json"],
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "oxlint extensions",
    "format": "oxfmt --write extensions",
    "format:check": "oxfmt --check extensions"
  },
  "pi": {
    "extensions": ["./extensions/ask-mode"]
  },
  "devDependencies": {
    "@types/node": "24",
    "oxfmt": "^0.43.0",
    "oxlint": "^1.58.0",
    "typescript": "^6.0.0"
  },
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-tui": "*"
  },
  "peerDependenciesMeta": {
    "@earendil-works/pi-coding-agent": { "optional": true },
    "@earendil-works/pi-tui": { "optional": true }
  }
}
```

### 2. Create `packages/ask-mode/tsconfig.json` [DONE:2]

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "tsBuildInfoFile": "./node_modules/.cache/ask-mode.tsbuildinfo",
    "rootDir": "."
  },
  "include": ["extensions/**/*.ts"]
}
```

### 3. Create `packages/ask-mode/extensions/ask-mode/utils.ts` [DONE:3]

Port from `packages/plan-mode/extensions/plan-mode/utils.ts`. Copy these exactly:
- `DESTRUCTIVE_PATTERNS` array
- `SAFE_PATTERNS` array
- `splitPipeSegments()` function

For `isSafeCommand()`: copy but **remove** the `mkdir .plans/` special case at the top. The function body becomes:

```typescript
export function isSafeCommand(command: string): boolean {
  const segments = splitPipeSegments(command);
  return segments.every((seg) => {
    const trimmed = seg.trim();
    const isDestructive = DESTRUCTIVE_PATTERNS.some((p) => p.test(trimmed));
    const isSafe = SAFE_PATTERNS.some((p) => p.test(trimmed));
    return !isDestructive && isSafe;
  });
}
```

Only export `isSafeCommand`. No other exports needed (no TodoItem, no extractTodoItems, etc.).

### 4. Create `packages/ask-mode/extensions/ask-mode/index.ts` [DONE:4]

```typescript
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { Key } from '@earendil-works/pi-tui';
import { isSafeCommand } from './utils.js';

const ASK_TOOLS = ['read', 'bash', 'grep', 'find', 'ls'];

interface PersistedState {
  askEnabled: boolean;
}

export default function askMode(pi: ExtensionAPI): void {
  let askEnabled = false;
  let previousTools: string[] | undefined;

  pi.registerFlag('ask', {
    description: 'Start in ask mode (read-only)',
    type: 'boolean',
    default: false,
  });

  function persist(): void {
    pi.appendEntry<PersistedState>('ask-mode', { askEnabled });
  }

  function updateUI(ctx: ExtensionContext): void {
    ctx.ui.setStatus('ask-mode', askEnabled ? ctx.ui.theme.fg('accent', '🔍 ask') : undefined);
  }

  function enterAskMode(ctx: ExtensionContext): void {
    previousTools = [...pi.getActiveTools()];
    askEnabled = true;
    pi.setActiveTools(ASK_TOOLS);
    updateUI(ctx);
    persist();
    ctx.ui.notify('Ask mode ON — read-only tools only', 'info');
  }

  function exitAskMode(ctx: ExtensionContext): void {
    askEnabled = false;
    if (previousTools) {
      pi.setActiveTools(previousTools);
      previousTools = undefined;
    }
    updateUI(ctx);
    persist();
    ctx.ui.notify('Ask mode OFF — full tool access restored', 'info');
  }

  // ── Command: /ask ─────────────────────────────────────────────────────
  pi.registerCommand('ask', {
    description: 'Toggle ask mode (read-only)',
    handler: async (args, ctx) => {
      if (askEnabled) {
        exitAskMode(ctx);
        return;
      }
      enterAskMode(ctx);
      const prompt = args?.trim();
      if (prompt) {
        pi.sendUserMessage(prompt);
      }
    },
  });

  // ── Shortcut: Ctrl+Alt+A ─────────────────────────────────────────────
  pi.registerShortcut(Key.ctrlAlt('a'), {
    description: 'Toggle ask mode',
    handler: async (ctx) => {
      if (askEnabled) exitAskMode(ctx);
      else enterAskMode(ctx);
    },
  });

  // ── Defense-in-depth: block destructive calls ─────────────────────────
  pi.on('tool_call', async (event) => {
    if (!askEnabled) return;

    if (event.toolName === 'edit' || event.toolName === 'write') {
      return {
        block: true,
        reason: 'Ask mode: file modifications are not allowed. Use /ask to exit ask mode first.',
      };
    }

    if (event.toolName === 'bash') {
      const command = event.input.command as string;
      if (!isSafeCommand(command)) {
        return {
          block: true,
          reason: `Ask mode: command blocked. Only read-only commands are allowed.\nCommand: ${command}\nUse /ask to exit ask mode first.`,
        };
      }
    }
  });

  // ── Inject read-only instructions ─────────────────────────────────────
  pi.on('before_agent_start', async () => {
    if (!askEnabled) return;
    return {
      message: {
        customType: 'ask-mode-context',
        content: `[ASK MODE ACTIVE]
You are in ask mode — a read-only mode with strict restrictions.

Restrictions:
- Available tools: ${ASK_TOOLS.join(', ')}
- Bash is restricted to read-only commands (ls, grep, cat, git status, etc.)
- edit and write tools are NOT available
- Do NOT attempt to create, modify, or delete any files

Your task is to answer questions, analyze code, explore the codebase, and provide recommendations without making any changes.`,
        display: false,
      },
    };
  });

  // ── Filter stale context when ask mode is off ─────────────────────────
  pi.on('context', async (event) => {
    if (askEnabled) return;
    return {
      messages: event.messages.filter((m) => {
        const msg = m as typeof m & { customType?: string };
        return msg.customType !== 'ask-mode-context';
      }),
    };
  });

  // ── Restore state ─────────────────────────────────────────────────────
  function restoreFromEntries(entries: Array<{ type: string; customType?: string; data?: unknown }>): void {
    const saved = entries
      .filter((e) => e.type === 'custom' && e.customType === 'ask-mode')
      .pop() as { data?: PersistedState } | undefined;
    if (saved?.data) {
      askEnabled = saved.data.askEnabled;
    }
  }

  pi.on('session_start', async (_event, ctx) => {
    if (pi.getFlag('ask') === true) {
      askEnabled = true;
    }

    restoreFromEntries(ctx.sessionManager.getEntries());

    if (askEnabled) {
      pi.setActiveTools(ASK_TOOLS);
    }
    updateUI(ctx);
  });

  pi.on('session_tree', async (_event, ctx) => {
    const entries = ctx.sessionManager.getBranch?.() ?? ctx.sessionManager.getEntries();
    askEnabled = false; // reset before scanning
    restoreFromEntries(entries);

    if (askEnabled) {
      pi.setActiveTools(ASK_TOOLS);
    }
    updateUI(ctx);
  });
}
```

**Key points — do NOT deviate:**
- No `agent_end` handler. No post-turn prompt/menu. User chats freely.
- No `.plans/` file creation. No plan tracking. No todos.
- No widgets — only `setStatus()` for the "🔍 ask" indicator.
- Named export: `export default function askMode(pi: ExtensionAPI)`.
- Save `previousTools` on enter, restore on exit.
- `restoreFromEntries` is a shared helper for both `session_start` and `session_tree`.

### 5. Create `packages/ask-mode/README.md` [DONE:5]

```markdown
# @dreki-gg/pi-ask-mode

Read-only ask mode for [pi](https://github.com/badlogic/pi-mono). Toggle with `/ask` — pi can read, search, and answer but cannot create, edit, or delete files.

## Install

pi install npm:@dreki-gg/pi-ask-mode

## Usage

| | |
|---|---|
| Flag | `pi --ask` |
| Command | `/ask` to toggle on/off |
| Shortcut | `Ctrl+Alt+A` |

`/ask How does auth work?` enters ask mode and sends the prompt in one step.

## Allowed

`read`, `bash` (read-only: ls, grep, cat, git status…), `grep`, `find`, `ls`

## Blocked

`edit`, `write`, destructive bash (rm, mv, cp, mkdir, git commit/push, npm install, redirects, etc.)

## How it works

Two layers: tool whitelist via `setActiveTools()` + defense-in-depth `tool_call` blocking. State persists across restarts and tree navigation.
```

### 6. Run `bun install` and `bun run typecheck` [DONE:6]

Fix any type errors before marking done.

## Constraints

- **No Bun APIs** — extension needs zero file I/O
- **Only built-in tools in ASK_TOOLS** — `read`, `bash`, `grep`, `find`, `ls`
- **Theme colors** — `'accent'` for status. No `'info'` color exists.
- **No `agent_end` handler** — no post-turn prompts or menus
- **No `.plans/` files** — no plan workflow, just a mode toggle
- **Semicolons** — match repo code style
- **Named default export** — `export default function askMode(pi: ExtensionAPI)`

Mark each step done with `[DONE:n]` after completing it.

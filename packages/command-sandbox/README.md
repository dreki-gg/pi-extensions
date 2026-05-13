# @dreki-gg/pi-command-sandbox

Shared command sandboxing utilities for pi extensions. Validates shell commands against safe/destructive pattern lists using proper shell parsing via [shell-quote](https://github.com/ljharb/shell-quote).

## Why

Pi extensions like `plan-mode` and `ask-mode` restrict bash commands to read-only operations. Previously, each extension had its own regex-based parser that only split on pipes (`|`), causing false positives when agents used concatenated commands (`&&`, `||`, `;`) — even when every individual command was safe.

This package solves that by using `shell-quote` to properly tokenize shell commands, then validating each segment independently.

## Usage

```ts
import { isSafeCommand } from '@dreki-gg/pi-command-sandbox';

// Simple commands
isSafeCommand('ls -la');           // true
isSafeCommand('rm -rf /');         // false

// Concatenated commands — the fix
isSafeCommand('cd src && ls -la'); // true  ← was blocked before
isSafeCommand('ls && rm -rf /');   // false ← still blocked

// Pipes work too
isSafeCommand('find . -name "*.ts" | grep -v node_modules'); // true

// Quoted operators are handled correctly
isSafeCommand('echo "hello && world"'); // true (not split)

// Command substitution is blocked by default
isSafeCommand('echo $(rm -rf /)'); // false
```

### Custom options

```ts
import { isSafeCommand } from '@dreki-gg/pi-command-sandbox';

isSafeCommand('mkdir -p .plans/my-plan', {
  // Allow specific commands via predicate
  allowCommand: (cmd) => /^\s*mkdir\s+(-p\s+)?\.plans\//.test(cmd),
});

isSafeCommand('bun test', {
  // Extend the safe patterns list
  extraSafe: [/^\s*bun\s+(test|run)/i],
});

isSafeCommand('curl -X POST https://example.com', {
  // Extend the destructive patterns list
  extraDestructive: [/\bcurl\s+.*-X\s+(POST|PUT|DELETE)/i],
});
```

### Lower-level API

```ts
import { parseCommandSegments, hasCommandSubstitution } from '@dreki-gg/pi-command-sandbox';

parseCommandSegments('cd foo && ls -la');
// → [{ command: 'cd foo', hasRedirect: false },
//    { command: 'ls -la', hasRedirect: false }]

hasCommandSubstitution('echo $(whoami)'); // true
```

## Patterns

The package exports two pattern lists:

- **`DESTRUCTIVE_PATTERNS`** — commands that modify the filesystem, install packages, manage processes, etc.
- **`SAFE_PATTERNS`** — read-only commands (ls, cat, grep, git status, etc.)

Both can be extended via `extraSafe` and `extraDestructive` options.

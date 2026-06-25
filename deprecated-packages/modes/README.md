# @dreki-gg/pi-modes

Config-driven preset and mode switching for [pi](https://github.com/badlogic/pi-mono).

Use it to create hard-enforced modes like `explore`, `implement`, or `review` that can:
- restrict tool access
- inject mode-specific instructions
- optionally switch model and thinking level
- persist until explicitly changed

## Install

```bash
pi install npm:@dreki-gg/pi-modes
```

## What it provides

| Feature | Name | Notes |
|---|---|---|
| Flag | `--preset <name>` | Start pi in a configured mode |
| Command | `/preset [name]` | Select, apply, or clear a preset |
| Command | `/mode [name]` | Alias of `/preset` |
| Command | `/modes` | List loaded presets and the active preset |
| Slash alias | `/<preset-name>` | Typing `/explore` applies preset `explore` |

## Config files

Presets are loaded from:

- global: `~/.pi/agent/presets.json`
- project: `.pi/presets.json`

Project presets override global presets **field-by-field** for presets with the same name.

On first run after install, `pi-modes` bootstraps starter defaults into the global file:
- if `~/.pi/agent/presets.json` does not exist, it creates it
- if it exists, it adds any missing starter presets
- it does **not** overwrite existing preset names

## Starter defaults

Today the package seeds this starter preset automatically:

- `explore`

You can edit or remove it after bootstrap.

## Example `presets.json`

```json
{
  "explore": {
    "description": "Read-only exploration and brainstorming",
    "tools": ["read", "lsp", "context7_*", "questionnaire"],
    "thinkingLevel": "high",
    "instructions": "You are in EXPLORE MODE. Your job is to understand, inspect, brainstorm, and ask questions. Do not make changes. Focus on analysis, tradeoffs, risks, and next-step recommendations."
  },
  "implement": {
    "tools": ["read", "bash", "edit", "write"],
    "instructions": "You are in IMPLEMENT MODE. Make focused, correct changes and verify them before finishing."
  }
}
```

## Preset schema

```ts
{
  [name: string]: {
    description?: string;
    provider?: string;
    model?: string;
    thinkingLevel?: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
    tools?: string[];      // exact tool names or wildcard patterns like "context7_*"
    instructions?: string; // appended to the system prompt when active
    aliases?: string[];    // optional extra slash aliases
  }
}
```

Notes:
- Every preset name automatically works as a slash alias, so `explore` becomes `/explore`.
- If a prompt template, skill, or other slash command already uses that name, the existing command wins and the alias is skipped.
- Tool patterns support `*` wildcard matching.
- If a preset specifies unknown tools or patterns that match nothing, the extension warns you.

## Usage

```bash
pi --preset explore
```

Inside pi:

```text
/preset explore
/mode implement
/explore
/preset off
/modes
```

If `/preset` or `/mode` is called without an argument in interactive mode, the extension opens a selector.

## Explore mode example

This package is a good fit for a hard-enforced exploration mode where pi can inspect and reason without write access:

```json
{
  "explore": {
    "tools": ["read", "lsp", "context7_*", "questionnaire"],
    "instructions": "You are in EXPLORE MODE. Investigate, ask clarifying questions, compare options, and brainstorm. Do not make or propose file edits in this mode."
  }
}
```

That disables `bash`, `edit`, `write`, and `subagent` by omission.

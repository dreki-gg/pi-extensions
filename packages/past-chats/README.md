# @dreki-gg/pi-past-chats

Reference previous Pi sessions inline with `@chat:` or `@session:`.

## Usage

Type either prefix in the Pi editor:

```text
Use the approach from @chat:
Compare this with @session:
```

Autocomplete shows sessions from:

1. the current working directory, and
2. external folders configured in `.pi/past-chats.json`.

Selecting a suggestion inserts a stable token such as `@chat:9ab12cd34ef0`. When you submit the prompt, the extension injects a hidden context message with:

- session title/name
- session file path
- cwd/source folder
- created/modified dates
- message count
- deterministic handoff summary
- optional cached AI handoff summary when enabled

The agent can use the injected summary immediately, or read the listed session JSONL file for deeper details.

## Commands

```text
/past-chats list
/past-chats add <path> [label]
/past-chats remove <label|path>
/past-chats refresh
/past-chats summarize @session:<id>
```

Examples:

```text
/past-chats add ../api API
/past-chats add /Users/me/work/mobile Mobile App
/past-chats list
```

## Config

Project config lives at:

```text
.pi/past-chats.json
```

Example:

```json
{
  "folders": [
    { "path": "../api", "label": "API" },
    { "path": "/Users/me/work/mobile", "label": "Mobile App" }
  ],
  "summary": {
    "ai": false,
    "provider": "openai",
    "model": "gpt-5-mini"
  }
}
```

Notes:

- The current cwd is always included implicitly.
- Folder paths are resolved relative to the current cwd unless absolute.
- AI summaries are opt-in with `summary.ai: true` and require a configured provider/model/API key.
- If AI summary generation fails, the extension falls back to deterministic summaries.

## Cache

AI summaries are cached in:

```text
.pi/past-chats-cache.json
```

Cache entries are invalidated by session path, modified timestamp, summary version, provider, and model.

## Install

```bash
pi install npm:@dreki-gg/pi-past-chats
```

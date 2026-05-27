# @dreki-gg/pi-context-folders

Add sibling project folders as searchable context for pi agents. The agent automatically learns about configured folders and can search them using existing tools (grep, find, read, ls).

## Installation

```bash
pi install @dreki-gg/pi-context-folders
```

## Configuration

Create `.pi/context-folders.json` in your project root (or use `/context-folders init`):

```json
{
  "folders": [
    { "path": "../sibling-project", "label": "Sibling Project" },
    { "path": "/absolute/path/to/other", "label": "Other Project" }
  ]
}
```

- **path** — relative (to project root) or absolute path to the folder
- **label** — optional human-readable name (defaults to folder basename)

## How It Works

On session start, the extension reads your config and injects folder information into the agent's system prompt. The agent can then use its standard tools to search and read files in those folders — no extra tools needed.

## Commands

| Command | Description |
|---------|-------------|
| `/context-folders` | List all configured folders with status |
| `/context-folders add <path> [label]` | Add a folder to the config |
| `/context-folders remove <path-or-label>` | Remove a folder by path or label |
| `/context-folders init` | Create a blank config file |

## Example

```bash
# Add a sibling project
/context-folders add ../my-api-server API Server

# List configured folders
/context-folders

# Then just ask the agent naturally:
# "Find all usages of the `UserService` class in the API Server project"
```

## License

MIT

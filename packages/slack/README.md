# @dreki-gg/pi-slack

Slack read tools for [pi](https://github.com/earendil-works/pi-coding-agent) — messages, threads, channels, search, and file/image downloads.

Uses [Effect](https://effect.website) for the Slack client layer (typed errors, retries, rate limit handling).

## Tools

| Tool | Description |
|------|-------------|
| `slack_list_channels` | List channels the bot has access to |
| `slack_read_messages` | Read message history from a channel |
| `slack_read_thread` | Read replies in a thread |
| `slack_search` | Full-text search across workspace (requires user token) |
| `slack_download_file` | Download a shared file/image to temp directory |

## Setup

### 1. Create a Slack App

Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps) with these bot token scopes:

- `channels:history` — read public channel messages
- `channels:read` — list public channels
- `groups:history` — read private channel messages
- `groups:read` — list private channels
- `im:history` — read DMs
- `files:read` — access file info and downloads
- `search:read` — search messages (user token only)

### 2. Set environment variables

```bash
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_USER_TOKEN=xoxp-...  # Optional, needed for search
```

### 3. Optional project config

Create `.pi/slack.json` in your project:

```json
{
  "defaultChannel": "C0123ABC456",
  "messageLimit": 50
}
```

## Install

```bash
pi install @dreki-gg/pi-slack
```

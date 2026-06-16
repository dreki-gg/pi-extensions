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
| `slack_post_message` | Post a message to a channel or reply in a thread (requires `chat:write`) |
| `slack_edit_message` | Edit a message the bot previously posted (requires `chat:write`) |
| `slack_delete_message` | Delete a message the bot previously posted (requires `chat:write`) |

## Setup

### 1. Create a Slack App

Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**. Give it a name (e.g. `pi-context`) and select your workspace.

### 2. Add OAuth scopes

In the left sidebar → **OAuth & Permissions** → scroll to **Scopes**.

**Bot Token Scopes** (for `SLACK_BOT_TOKEN`):

| Scope | Enables |
|-------|---------|
| `channels:read` | list public channels |
| `channels:history` | read public channel messages |
| `groups:read` | list private channels |
| `groups:history` | read private channel messages |
| `im:history` | read DMs |
| `files:read` | file info + image/file downloads |

**User Token Scopes** (for `SLACK_USER_TOKEN` — only needed for `slack_search`):

| Scope | Enables |
|-------|---------|
| `search:read` | `slack_search` tool |

> `search.messages` is only available with a **user** token — bots cannot search. Skip the user token entirely if you don't need search.

### 3. Install to workspace

Still on **OAuth & Permissions** → click **Install to Workspace** at the top → authorize. (If your workspace requires admin approval, an admin must approve it.)

### 4. Copy the tokens

After installing, the same page shows:

- **Bot User OAuth Token** — starts with `xoxb-` → your `SLACK_BOT_TOKEN`
- **User OAuth Token** — starts with `xoxp-` → your `SLACK_USER_TOKEN`

```bash
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_USER_TOKEN=xoxp-...  # Optional, needed for slack_search
```

### 5. Invite the bot to channels

A bot token can only read channels the bot is **a member of**. In each Slack channel you want the agent to read, type:

```
/invite @your-app-name
```

Otherwise `slack_read_messages` returns `not_in_channel`.

### 6. Optional project config

Create `.pi/slack.json` in your project to set a default channel and message limit:

```json
{
  "defaultChannel": "C0123ABC456",
  "messageLimit": 50
}
```

## Finding channel IDs

Open a channel in Slack → click the channel name → scroll to the bottom of the popup; the ID (`C0123ABC456`) is shown there. Or run `slack_list_channels` once the bot is installed to list channels with their IDs.

## Checking status

Run `/slack` in pi to see token detection and project config status.

## Install

```bash
pi install @dreki-gg/pi-slack
```

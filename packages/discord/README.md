# @dreki-gg/pi-discord

Discord read tools for [pi](https://github.com/earendil-works/pi-coding-agent) — pull channel messages and attachments so agents have product context (e.g. a `#issues-and-suggestions` channel).

Uses [Effect](https://effect.website) for the Discord client layer (typed errors, retries, rate limit handling). Bot-token auth only — automating a **user** account violates Discord's ToS.

## Tools

| Tool | Description |
|------|-------------|
| `discord_list_channels` | List text channels in a server (guild) the bot can access |
| `discord_read_messages` | Read message history from a channel (oldest-first, paginate with `before`) |
| `discord_download_attachment` | Download an image/file from a message to a temp path |

> No search tool: Discord's message search is user-account-only and not available to bots.

## Setup

### 1. Create a Discord app + bot

Go to [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application** → name it (e.g. `pi-context`).

In the left sidebar → **Bot** → **Reset Token** → copy the token → this is your `DISCORD_BOT_TOKEN`.

### 2. Enable the Message Content intent (required)

Still on the **Bot** page → scroll to **Privileged Gateway Intents** → toggle **Message Content Intent** ON.

> ⚠️ Without this, the REST API returns **empty `content`** for every message. For a bot in fewer than 100 servers this toggle needs no Discord verification.

### 3. Invite the bot to your server

Left sidebar → **OAuth2** → **URL Generator**:

- **Scopes**: `bot`
- **Bot Permissions**: `View Channels`, `Read Message History`

Copy the generated URL, open it, pick your server, authorize. (You need **Manage Server** permission on that server, or ask an admin.)

### 4. Get guild + channel IDs

In the Discord client → **Settings → Advanced → Developer Mode** ON. Then right-click a server → **Copy Server ID** (guild), and right-click a channel → **Copy Channel ID**.

### 5. Set the token

```bash
export DISCORD_BOT_TOKEN="your-bot-token"
```

## Project config (`.pi/discord.json`)

All fields optional:

```json
{
  "defaultGuild": "123456789012345678",
  "defaultChannel": "234567890123456789",
  "messageLimit": 50
}
```

- `defaultGuild` — used by `discord_list_channels` when you don't pass `guild`.
- `defaultChannel` — informational (shown in `/discord` status).
- `messageLimit` — default page size for `discord_read_messages` (1-100, default 50).

## Commands

- `/discord` — show token + config status.

## Notes

- IDs are numeric **snowflakes**.
- The bot only sees servers it's invited to and channels where it has `View Channel` + `Read Message History`.
- `discord_read_messages` returns newest-first from Discord but is formatted oldest-first; use the returned `oldestId` as `before` to page further back.
- Attachment URLs are public Discord CDN links — `discord_download_attachment` fetches them without auth.

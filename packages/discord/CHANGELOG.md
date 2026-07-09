# @dreki-gg/pi-discord

## 0.2.0

### Minor Changes

- e3bb06c: New package: `@dreki-gg/pi-discord` — Discord read tools for pi.

  Pull channel messages and attachments into agent context via a Discord **bot**
  token (ToS-safe; no user-account automation). Mirrors the `@dreki-gg/pi-slack`
  architecture — an Effect-powered client with typed errors, retry, and rate-limit
  handling.

  Tools:

  - `discord_list_channels` — list text channels in a server (guild).
  - `discord_read_messages` — read channel history (oldest-first, `before`/`after`
    snowflake pagination).
  - `discord_download_attachment` — download a message attachment (image/file) to a
    temp path for the agent to `read`.

  Plus a `/discord` status command and `.pi/discord.json` project config
  (`defaultGuild`, `defaultChannel`, `messageLimit`). Requires `DISCORD_BOT_TOKEN`
  and the **Message Content** privileged intent enabled in the Discord Developer
  Portal.

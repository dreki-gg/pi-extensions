# @dreki-gg/pi-slack

## 0.4.0

### Minor Changes

- Add a `slack_delete_message` tool that deletes a message the bot previously
  posted via Slack's `chat.delete` API. Pass the channel ID and the message `ts`;
  bots can only delete their own messages. No new scope is required — it uses the
  existing `chat:write` permission.

## 0.3.0

### Minor Changes

- Add `slack_edit_message` tool so the agent can edit messages it previously posted. Pass the `channel` ID and the message `ts` (returned by `slack_post_message`) along with the new `text` to rewrite a message via Slack's `chat.update`. Reuses the existing `chat:write` scope — bots can only edit their own messages.

## 0.2.0

### Minor Changes

- Add `slack_post_message` tool to post messages to a channel or reply in a thread. Posting is gated by the Slack app's `chat:write` OAuth scope (the bot must also be a member of the target channel); scope/permission errors from Slack are surfaced clearly.

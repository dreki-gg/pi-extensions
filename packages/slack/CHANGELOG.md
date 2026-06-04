# @dreki-gg/pi-slack

## 0.2.0

### Minor Changes

- Add `slack_post_message` tool to post messages to a channel or reply in a thread. Posting is gated by the Slack app's `chat:write` OAuth scope (the bot must also be a member of the target channel); scope/permission errors from Slack are surfaced clearly.

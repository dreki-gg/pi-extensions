# @dreki-gg/pi-past-chats

## 0.3.0

### Minor Changes

- Add argument autocompletion to slash commands. Typing after `/impeccable`,
  `/stack`, `/babysit`, `/pr-canvas`, `/context-folders`, or `/past-chats` now
  suggests the available sub-commands (filtered by prefix, with descriptions),
  so you no longer have to remember the exact verb to type.

## 0.2.0

### Minor Changes

- Add `search_past_chats` agent tool: fuzzy-search indexed past Pi sessions
  (current cwd plus folders configured in `.pi/past-chats.json`) and get back the
  matching session JSONL file paths, a relevance snippet, and a fuzzy score
  (lower is better), sorted best match first. The agent can then `read` any
  returned path to inspect the full prior conversation — letting it narrow down
  which past chats discussed a topic before pulling in detail. Complements the
  existing `@chat:`/`@session:` autocomplete without changing it.

## 0.1.2

### Patch Changes

- a8413b2: Use Effect Schema for typed config and cache decoding in the past chats extension.

## 0.1.1

### Patch Changes

- Add inline past chat references with `@chat:` and `@session:` autocomplete, context injection, external folder indexing, and optional cached AI summaries.

## 0.1.0

- Initial package scaffold.

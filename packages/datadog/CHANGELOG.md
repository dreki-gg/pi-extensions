# @dreki-gg/pi-datadog

## 0.3.0

### Minor Changes

- Add `datadog_rum_search` tool for searching Datadog RUM events (sessions, views, actions, front-end errors). Defaults to session events and, like the logs tool, returns a compact inline digest while writing the full untruncated events to a temp file the agent can read. Adds optional `rumApplicationId` / `rumService` fields to `.pi/datadog.json` (with per-call overrides), and surfaces them in the `/datadog` status command.

## 0.2.4

### Patch Changes

- Return a compact digest inline and write full log entries to a temp file.

  `datadog_logs_search` no longer dumps truncated log entries inline. Instead it returns a token-light digest (result count, status breakdown, services, pagination) plus the path to a temp file containing the complete, untruncated results (full messages and attributes). The agent reads that file with the `read` tool when it needs actual log content — saving context tokens, removing the truncation blind spot, and avoiding extra rate-limited re-queries. Tool guidelines were updated to point at the file.

## 0.2.3

### Patch Changes

- Write full untruncated log search results to a temp file the agent can read.

  The inline `datadog_logs_search` output still truncates long messages and attributes for brevity, but the complete, untruncated results are now also written to a temp file and the path is included in the response. When the agent needs full message content (status codes, paths, stack traces), it can `read` that file instead of re-querying Datadog — avoiding both the truncation blind spot and extra rate-limited requests. Tool guidelines were updated to point at the file.

## 0.2.2

### Patch Changes

- Handle Datadog rate limits gracefully instead of failing on 429s.

  The log search client now enables the Datadog SDK's built-in retry (up to 4 attempts on 429/5xx), which honours the `x-ratelimit-reset` header and waits exactly the window Datadog asks for before retrying. When retries are exhausted, the tool returns a clear, actionable message (distinguishing rate-limit, auth, and other API errors) telling the agent to back off and keep queries narrow/batched rather than firing again immediately. Tool guidelines were updated to reinforce this batching behaviour.

## 0.2.1

### Patch Changes

- Load project-root `.env` files so `DD_API_KEY` / `DD_APP_KEY` defined there are picked up.

  Previously credentials were only read from the process environment, so keys placed in a project's `.env` (without exporting them in the shell) were never found and the extension reported missing credentials. The extension now loads `<cwd>/.env` via Node's built-in `process.loadEnvFile` at session start, before the tool runs, and in the `/datadog` status command. Shell-exported variables still take precedence over `.env` values.

## 0.2.0

### Minor Changes

- New Datadog extension — search production logs from within pi with project-aware context via `.pi/datadog.json`.

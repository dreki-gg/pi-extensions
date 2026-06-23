# @dreki-gg/pi-jira

## 0.2.0

### Minor Changes

- New extension: Jira tools backed by an authenticated Atlassian CLI (`acli`)
  session. `jira_view` pulls a ticket's description and comments into context,
  `jira_search` runs JQL queries, `jira_comments` reads a ticket's thread, and
  `jira_comment` posts a concise comment back. Every read tool returns a compact
  digest inline and writes the full, untruncated output to a temp file (so long
  descriptions and comment threads survive harness truncation — the agent reads
  the file). A `/jira` command reports auth and config status, and `.pi/jira.json`
  supports `acliPath`, `defaultProject`, `viewFields`, and `searchLimit`.

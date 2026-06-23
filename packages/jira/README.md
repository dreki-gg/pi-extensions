# @dreki-gg/pi-jira

Jira tools for [pi](https://github.com/earendil-works/pi-coding-agent) that ride on an **authenticated Atlassian CLI (`acli`) session** — pull ticket context into the agent and post concise comments back. No API tokens to manage in pi; auth lives entirely in your `acli` session.

## Tools

| Tool | Description |
|------|-------------|
| `jira_view` | Fetch a work item (description + comments) for context. Returns a compact digest inline and writes the full ticket to a temp file for `read`. |
| `jira_search` | Search work items with JQL. Returns a compact list of keys, statuses, and summaries. |
| `jira_comments` | List the comment thread on a work item. |
| `jira_comment` | Post a concise comment to a work item. |

There is also a `/jira` command that reports auth + config status.

## Setup

### 1. Install and authenticate the Atlassian CLI

Install [`acli`](https://developer.atlassian.com/cloud/acli/) and log in **once** in your terminal:

```bash
acli jira auth login
acli jira auth status   # confirm you have an active session
```

pi reuses that session — it never sees your credentials.

### 2. Install the extension

```bash
pi install npm:@dreki-gg/pi-jira
```

On session start the extension runs `acli jira auth status`; if there is no active session it warns you to run `acli jira auth login`.

## Project config (optional)

Create `.pi/jira.json` in your project root:

```json
{
  "acliPath": "acli",
  "defaultProject": "PROJ",
  "viewFields": "summary,issuetype,status,priority,assignee,reporter,labels,components,parent,description,comment,created,updated",
  "searchLimit": 25
}
```

| Field | Default | Purpose |
|-------|---------|---------|
| `acliPath` | `"acli"` | Path/name of the `acli` binary. Set this if `acli` is not on `PATH`. |
| `defaultProject` | _(none)_ | Lets you pass a bare number (e.g. `123` → `PROJ-123`). |
| `viewFields` | curated set | Fields requested by `jira_view` (`acli` `--fields` syntax; `*all` for everything). |
| `searchLimit` | `25` | Default max results for `jira_search`. |

## How context flows

**Invariant: every read tool returns a compact digest inline and writes the full, untruncated output to a temp file whose path is in the response.** Inline content can be truncated by the harness, so the on-disk copy is the source of truth — `read` the file path instead of re-fetching. Atlassian Document Format is flattened to text in both. Which tools write files, the digest shape, and the filename pattern are owned by `extensions/jira/index.ts` + `format.ts`, not restated here.

## Notes

- Comments are visible to your whole team. The agent is instructed to keep them concise and to confirm wording before posting unless you explicitly asked it to post.
- Runs on Node.js (pi loads extensions via jiti) and shells out to `acli` with `child_process.execFile` — comment bodies and JQL are passed as discrete argv entries, so there is no shell-injection surface.

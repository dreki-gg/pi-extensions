# @dreki-gg/pi-pr-babysitter

In-session PR babysitter for [pi](https://github.com/earendil-works/pi).

Watches the **current branch's open PR** and wakes the agent whenever a check
newly fails or a new review / bot (e.g. Cursor bugbot) comment lands. It is
**observe-only**: it never pushes commits or posts PR comments — you and the
agent decide what to do.

## Prerequisites

- [GitHub CLI (`gh`)](https://cli.github.com/) installed and authenticated (`gh auth login`)

## Installation

```bash
pi install @dreki-gg/pi-pr-babysitter
```

## Usage

Two surfaces, same engine.

### `/babysit` command (background, human-invoked)

```
/babysit start    # Resolve the current branch's PR and start watching (polls every 60s)
/babysit stop     # Stop watching
/babysit status   # Show the watched PR, seen counts, and last poll time
```

When new activity appears, the babysitter wakes the agent with a `followUp`
message describing the failed checks and new comments. The agent then
investigates (e.g. `gh run view --log-failed`) and fixes code — but the
babysitter itself performs **no GitHub writes**.

### `babysit_pr` tool (blocking, agent-callable)

The agent can call `babysit_pr` after creating or pushing to a PR to **wait for
CI in a single tool call** instead of looping `sleep` + `gh pr checks` by hand
(which burns a turn per poll). It polls GitHub internally and returns a
structured verdict once the checks settle, the PR merges/closes, or it times out.

| Param | Default | Meaning |
|---|---|---|
| `pr` | current branch's PR | PR number to wait on |
| `pollSeconds` | 15 | internal poll interval |
| `timeoutSeconds` | 1200 | max total wait before returning `timeout` |
| `callTimeoutSeconds` | 30 | per-`gh`-call timeout; bounds a single hung call |

Outcomes: `passing`, `failing` (with failing check names), `merged`, `closed`,
`timeout`, `no_checks`, `cancelled` (Esc). New review/bot comments seen during
the wait are included in the report. While it waits, **no LLM tokens are
consumed**.

## How it works

- Polls `gh pr checks` and `gh pr view --json comments,reviews` plus inline
  review threads via `gh api repos/{owner}/{repo}/pulls/<n>/comments`.
- Classifies each check into tri-state health — **passing** (`pass`/`skipping`),
  **pending** (`pending`), **not passing** (`fail`/`cancel`) — and shows all
  three counts in `/babysit status`.
- Diffs each snapshot against persisted seen-state, so a still-red check or an
  already-seen comment never re-fires. A check fires only on the transition
  *into* not-passing — never on pending, and cancelled/timed-out checks count
  as not passing.
- Your own comments (the authenticated `gh` user) are skipped.
- When the PR leaves `OPEN`, it wakes the agent one last time (merged vs.
  closed-unmerged) and stops watching automatically.
- Seen-state is persisted per session, so `/reload` or resume does not re-fire
  previously seen activity when you restart the watch.

## Scope

Single current-branch PR, one watch at a time, human-invoked only (the agent
cannot start/stop the watch). For autonomous, server-side babysitting, build an
SDK app instead — this extension is the assistive, in-session variant.

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

```
/babysit start    # Resolve the current branch's PR and start watching (polls every 60s)
/babysit stop     # Stop watching
/babysit status   # Show the watched PR, seen counts, and last poll time
```

When new activity appears, the babysitter wakes the agent with a `followUp`
message describing the failed checks and new comments. The agent then
investigates (e.g. `gh run view --log-failed`) and fixes code — but the
babysitter itself performs **no GitHub writes**.

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

# @dreki-gg/pi-pr-babysitter

## 0.6.0

### Minor Changes

- Add the PR babysitter extension. `/babysit start` watches the current branch's
  open PR and, every 60 seconds, wakes the agent whenever a check newly fails or a
  new review / bot (e.g. Cursor bugbot) comment lands. It is observe-only — it
  surfaces activity into the session but never pushes commits or posts PR
  comments. Checks use a tri-state health model (passing / pending / not passing):
  the agent is woken only on the transition into not-passing (including
  cancelled/timed-out checks), never on pending, and status shows all three
  counts. When the PR leaves OPEN, the babysitter wakes the agent one last time
  (merged vs. closed-unmerged) and stops watching automatically. Seen-state is
  persisted so reload/resume never re-fires previously seen checks or comments.
  `/babysit stop` and `/babysit status` manage the watch.
- Add the agent-callable `babysit_pr` tool. After creating or pushing to a PR, the
  agent calls it once to block until CI checks settle (or the PR merges/closes),
  polling GitHub internally instead of looping `sleep` + `gh pr checks` by hand —
  so it no longer burns a turn per poll. Returns a structured verdict (`passing` /
  `failing` with check names / `merged` / `closed` / `timeout` / `no_checks` /
  `cancelled`) plus any new review/bot comments seen during the wait. A 1-second
  heartbeat keeps the elapsed counter ticking live between the 15s polls so a long
  wait stays visibly alive, and Esc cancels. While it waits, no LLM tokens are
  consumed. Configurable via `pr`, `pollSeconds` (default 15), and
  `timeoutSeconds` (default 1200).

## 0.5.0

### Minor Changes

- Add the PR babysitter extension. `/babysit start` watches the current branch's
  open PR and, every 60 seconds, wakes the agent whenever a check newly fails or a
  new review / bot (e.g. Cursor bugbot) comment lands. It is observe-only — it
  surfaces activity into the session but never pushes commits or posts PR
  comments. Checks use a tri-state health model (passing / pending / not passing):
  the agent is woken only on the transition into not-passing (including
  cancelled/timed-out checks), never on pending, and status shows all three
  counts. When the PR leaves OPEN, the babysitter wakes the agent one last time
  (merged vs. closed-unmerged) and stops watching automatically. Seen-state is
  persisted so reload/resume never re-fires previously seen checks or comments.
  `/babysit stop` and `/babysit status` manage the watch.
- Add the agent-callable `babysit_pr` tool. After creating or pushing to a PR, the
  agent calls it once to block until CI checks settle (or the PR merges/closes),
  polling GitHub internally instead of looping `sleep` + `gh pr checks` by hand —
  so it no longer burns a turn per poll. Returns a structured verdict (`passing` /
  `failing` with check names / `merged` / `closed` / `timeout` / `no_checks` /
  `cancelled`) plus any new review/bot comments seen during the wait, streams
  progress, and respects Esc cancellation. While it waits, no LLM tokens are
  consumed. Configurable via `pr`, `pollSeconds` (default 15), and
  `timeoutSeconds` (default 1200).

## 0.4.0

### Minor Changes

- Add the PR babysitter extension. `/babysit start` watches the current branch's
  open PR and, every 60 seconds, wakes the agent whenever a check newly fails or a
  new review / bot (e.g. Cursor bugbot) comment lands. It is observe-only — it
  surfaces activity into the session but never pushes commits or posts PR
  comments. Checks use a tri-state health model (passing / pending / not passing):
  the agent is woken only on the transition into not-passing (including
  cancelled/timed-out checks), never on pending, and status shows all three
  counts. When the PR leaves OPEN, the babysitter wakes the agent one last time
  (merged vs. closed-unmerged) and stops watching automatically. Seen-state is
  persisted so reload/resume never re-fires previously seen checks or comments.
  `/babysit stop` and `/babysit status` manage the watch.

## 0.3.0

### Minor Changes

- Add the PR babysitter extension. `/babysit start` watches the current branch's
  open PR and, every 60 seconds, wakes the agent whenever a check newly fails or a
  new review / bot (e.g. Cursor bugbot) comment lands. It is observe-only — it
  surfaces activity into the session but never pushes commits or posts PR
  comments. Checks use a tri-state health model (passing / pending / not passing):
  the agent is woken only on the transition into not-passing (including
  cancelled/timed-out checks), never on pending, and status shows all three
  counts. Seen-state is persisted so reload/resume never re-fires previously seen
  checks or comments. `/babysit stop` and `/babysit status` manage the watch.

## 0.2.0

### Minor Changes

- Add the PR babysitter extension. `/babysit start` watches the current branch's
  open PR and, every 60 seconds, wakes the agent whenever a check newly fails or a
  new review / bot (e.g. Cursor bugbot) comment lands. It is observe-only — it
  surfaces activity into the session but never pushes commits or posts PR
  comments. Seen-state is persisted so reload/resume never re-fires previously
  seen checks or comments. `/babysit stop` and `/babysit status` manage the watch.

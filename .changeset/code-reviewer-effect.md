---
'@dreki-gg/pi-code-reviewer': minor
---

refactor(code-reviewer): adopt Effect for IO and side effects

- Disk access (`.code-review.json`, lens markdown) and subprocess execution
  (`git` diffs, lens tools via `pi.exec`) now run as Effect programs against
  injectable `FileSystem` and `Executor` services, with `Data.TaggedError`
  types (`FileReadError`, `ExecError`), mirroring the conventions used by the
  firestore and lsp packages.
- Each module exposes a typed `*Effect` implementation plus a Promise wrapper
  that provides the live services, so command/tool call sites stay thin.
- Added a test suite (config, lens discovery/parsing, diff collection, lens
  review) driven entirely through service injection — no real disk or
  subprocess access required.

---
'@dreki-gg/pi-code-reviewer': minor
---

fix(code-reviewer): review untracked files + stop reporting failed passes as a clean review

- **Untracked (brand-new) files are now reviewed.** The default
  working-directory diff used `git diff HEAD`, which silently omits files that
  have never been `git add`ed — exactly the new files agents create. It now
  merges tracked changes with untracked files (diffed against `/dev/null` via
  `git diff --no-index`), so a review covers everything uncommitted. The
  collection is **read-only** (never `git add -N`), capped at 200 untracked
  files, and degrades per-file on failure. `--stat` is annotated with the new
  files, and `getChangedFiles` mirrors the merged set (deduped). `--staged` and
  `--base` keep pure git semantics (no untracked files).
- **Failed passes no longer masquerade as "0 findings ✅".** A pass that errors
  (e.g. the review model / pi-ai is unavailable) was swallowed into an empty
  result, so an all-failed run rendered as a clean review. The pipeline now
  captures a representative error (`telemetry.passErrorSample`) and the report
  is honest: an all-failed run is **Inconclusive** (no green check), a partial
  failure is flagged as **Partial review (M/N passes failed)**, and findings
  produced alongside failures carry a reduced-coverage warning.
- When **every** pass fails, the tool degrades to the single-pass fallback so
  the reviewing agent still produces a real review instead of an empty report.

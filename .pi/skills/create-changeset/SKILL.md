---
name: create-changeset
description: Create a changeset for changes to @dreki-gg/* packages in this monorepo. Use when the user says "create a changeset", "add a changeset", "changeset for this", or after making package changes that need a version bump before publishing.
---

# Create a Changeset

This monorepo uses [Changesets](https://github.com/changesets/changesets) to version and release the `@dreki-gg/*` extension packages. Every shippable change needs a changeset — **no changeset = no version bump = publish skipped**.

A changeset is a small markdown file in `.changeset/` with frontmatter declaring which package(s) bump and by how much, followed by a human-readable summary that becomes the CHANGELOG entry.

## Preferred: create the file directly

Agents usually don't have an interactive TTY, so write the file directly instead of running `changeset` (the interactive prompt). Use a short kebab-case name describing the change:

```bash
cat > .changeset/<short-kebab-name>.md << 'EOF'
---
"@dreki-gg/pi-<package>": minor
---

One concise paragraph describing the user-facing change and why it matters.
EOF
```

Example (`.changeset/plan-mode-plan-references.md`):

```markdown
---
"@dreki-gg/pi-plan-mode": minor
---

Add `@plan:<slug>` plan references with autocomplete. Type `@plan:` in any
message to fuzzy-search and tag a plan, and on send the plan's tasks + handoff
are attached as context.
```

The interactive equivalent — only when a TTY is available — is `bun run changeset`.

## Choosing the bump level (semver)

| Level | When |
|---|---|
| `patch` | Bug fix, internal refactor, docs/tests, no behavior change for users |
| `minor` | New backward-compatible feature, new tool/command/flag, additive option |
| `major` | Breaking change: removed/renamed tool or command, changed defaults, incompatible config |

When unsure between two levels, pick the higher one. Pre-1.0 packages still follow this convention here.

## Rules

- **One changeset per logical change.** A single PR touching several packages can list multiple packages in one changeset's frontmatter (one `"pkg": level` line each), or use separate files — prefer one file per coherent change.
- **Write for the CHANGELOG reader**, not the diff. Describe the behavior change and its value, not the implementation. No "refactored X to Y" unless that's the user-facing point.
- **Use the exact published package name** from `packages/<dir>/package.json` (`@dreki-gg/pi-...`). Private packages (`"private": true`) are not versioned — don't list them.
- **Don't run `changeset version` or publish** unless the user explicitly asks. Creating the changeset file is the deliverable; versioning/publishing is a separate step (see the `deploy-local` skill).

## Published packages

`pi-ask-mode`, `pi-browser-tools`, `pi-code-reviewer`, `pi-command-sandbox`, `pi-context-folders`, `pi-context7`, `pi-datadog`, `pi-firestore`, `pi-lsp`, `pi-miro`, `pi-modes`, `pi-past-chats`, `pi-plan-mode`, `pi-pr-canvas`, `pi-questionnaire`, `pi-slack`, `pi-subagent` (all under the `@dreki-gg/` scope).

## After creating the changeset

- Leave the file uncommitted for the user to review, or commit it alongside the change — match the user's workflow.
- Versioning happens later via `bun run version` (`changeset version`), which consumes all pending `.changeset/*.md` files, bumps versions, and updates each package's `CHANGELOG.md`.
- To actually release, publish to npm with `bun run publish` (or `bun run deploy:public`).

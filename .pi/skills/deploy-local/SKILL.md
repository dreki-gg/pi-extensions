---
name: deploy-local
description: Publish extension packages to the local Verdaccio npm registry at localhost:4873. Use when user says "deploy", "publish locally", "deploy local", "test my package", or wants to install their own extensions via npm.
---

# Deploy to Local Registry

This monorepo uses a local [Verdaccio](https://verdaccio.org/) registry at `http://localhost:4873` for publishing `@dreki-gg/*` packages so they can be installed via npm/bun without pushing to the public registry.

## Quick start

```bash
# Preview what will be versioned and published
bun run deploy:local:dry

# Version changed packages via changesets + publish
bun run deploy:local

# Republish all packages (e.g., after wiping Verdaccio storage)
bun run deploy:local:force
```

## Rules

- **NEVER unpublish a package** unless the user explicitly asks you to. If you published with a mistake, create a new patch/minor version with the fix instead.
- **NEVER republish the same version** with different contents. Every change gets a new version bump via changesets.
- Always create a changeset before publishing. No changeset = no version bump = publish skipped.

## Typical workflow

1. Make changes to one or more packages
2. Create a changeset describing the change:
   ```bash
   bun run changeset
   ```
   If TTY is unavailable, create the changeset file manually:
   ```bash
   cat > .changeset/my-change-name.md << 'EOF'
   ---
   "@dreki-gg/my-package": patch
   ---

   Description of the change.
   EOF
   ```
3. Apply versions:
   ```bash
   npx changeset version
   ```
4. Publish to the local registry:
   ```bash
   cd packages/<package> && npm publish --registry http://localhost:4873
   ```
5. Install the updated package anywhere on the machine:
   ```bash
   npm install @dreki-gg/pi-subagent   # routes to localhost:4873 automatically
   ```

## How it works

- **Scope routing**: `@dreki-gg:registry` is set to `http://localhost:4873` in the global `~/.npmrc`, so any `npm install @dreki-gg/*` resolves from Verdaccio.
- **Proxy**: Non-`@dreki-gg` packages are proxied through to the public npm registry transparently.
- **Private packages**: Packages with `"private": true` in their `package.json` are skipped automatically.
- **Idempotent**: Already-published versions are skipped unless `--force` is used.

## Verdaccio management

```bash
# Check status
curl -sf http://localhost:4873/ > /dev/null && echo "up" || echo "down"

# Start / stop
launchctl load   ~/Library/LaunchAgents/com.verdaccio.server.plist
launchctl unload ~/Library/LaunchAgents/com.verdaccio.server.plist

# Web UI
open http://localhost:4873

# Config
~/.config/verdaccio/config.yaml
```

## Troubleshooting

| Problem | Fix |
|---|---|
| Verdaccio not running | `launchctl load ~/Library/LaunchAgents/com.verdaccio.server.plist` |
| Auth errors on publish | `npm whoami --registry http://localhost:4873/` — re-add user if needed |
| Stale package after changes | Ensure you ran `bun run changeset` before deploying — no changeset = no version bump = skipped |
| Want to republish same version | Use `bun run deploy:local:force` |

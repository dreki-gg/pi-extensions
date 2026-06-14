---
name: deploy-local
description: Publish extension packages to the local Verdaccio npm registry at localhost:4873. Use when user says "deploy", "publish locally", "deploy local", "test my package", or wants to install their own extensions via npm.
---

# Deploy to Local Registry

This monorepo uses a local [Verdaccio](https://verdaccio.org/) registry at `http://127.0.0.1:4873` for publishing `@dreki-gg/*` packages so they can be installed via npm/bun without pushing to the public registry.

> **Windows / PowerShell:** use the `.ps1` scripts below. macOS/Linux use the `bun run deploy:local*` / launchctl flow further down. On Windows, always address the registry as `http://127.0.0.1:4873` — `localhost` may resolve to IPv6 `::1`, which Verdaccio does not bind.

## Windows (PowerShell)

One-time setup is already done: Verdaccio + jq installed, config at `scripts/verdaccio/config.yaml`, scope routing (`@dreki-gg:registry`) and an auth token in `~/.npmrc`.

```powershell
# Start / stop / check the registry
bun run registry:start      # or: pwsh -File ./scripts/local-registry.ps1 start
bun run registry:status
bun run registry:stop

# Publish
bun run deploy:local:win        # version (changesets) + publish changed packages
bun run deploy:local:win:force  # republish everything
bun run deploy:local:win:dry    # preview only

# Auto-start at logon (registers a hidden Scheduled Task 'DrekiLocalVerdaccio')
bun run registry:autostart
bun run registry:autostart:remove
```

Auto-start uses a per-user Scheduled Task triggered **at logon** (no admin needed, runs hidden). For a machine-wide service that starts before login, install via NSSM/node-windows instead.

- Registry runs detached; pid in `scripts/verdaccio/verdaccio.pid`, logs in `scripts/verdaccio/verdaccio.log`.
- Storage lives under `scripts/verdaccio/storage/`. Wipe it + run `deploy:local:win:force` to fully reseed.
- If publish returns `ENEEDAUTH`, the token in `~/.npmrc` (`//127.0.0.1:4873/:_authToken=`) is missing — recreate it by PUTting to `http://127.0.0.1:4873/-/user/org.couchdb.user:dreki`.

## macOS / Linux quick start

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

#!/usr/bin/env bash
# deploy-local.sh — Version with changesets and publish to local Verdaccio registry.
#
# Usage:
#   ./scripts/deploy-local.sh           # version + publish changed packages
#   ./scripts/deploy-local.sh --force   # republish all public packages (even unchanged)
#   ./scripts/deploy-local.sh --dry-run # show what would be published without doing it
#
set -euo pipefail

REGISTRY="http://localhost:4873"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FORCE=false
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --force)  FORCE=true ;;
    --dry-run) DRY_RUN=true ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

cd "$ROOT"

# ─── Preflight ────────────────────────────────────────────────────────────────

echo "🔍 Checking Verdaccio at $REGISTRY..."
if ! curl -sf "$REGISTRY" > /dev/null 2>&1; then
  echo "❌ Verdaccio is not running at $REGISTRY"
  echo "   Start it:  launchctl load ~/Library/LaunchAgents/com.verdaccio.server.plist"
  exit 1
fi
echo "   ✓ Verdaccio is up"

# ─── Consume changesets → bump versions ───────────────────────────────────────

CHANGESETS=($(ls .changeset/*.md 2>/dev/null | grep -v README.md || true))

if [ ${#CHANGESETS[@]} -gt 0 ]; then
  echo ""
  echo "📦 Found ${#CHANGESETS[@]} changeset(s):"
  for cs in "${CHANGESETS[@]}"; do
    echo "   • $(basename "$cs" .md)"
  done
  echo ""

  if [ "$DRY_RUN" = true ]; then
    echo "🏷️  [dry-run] Would run: changeset version"
    echo "   Skipping version bump."
  else
    echo "🏷️  Applying changeset versions..."
    npx changeset version
    echo "   ✓ Versions bumped"
  fi
else
  echo ""
  echo "📦 No pending changesets."
  if [ "$FORCE" = false ]; then
    echo "   Nothing to version. Use --force to republish all packages anyway."
  fi
fi

# ─── Build (if needed) ───────────────────────────────────────────────────────

echo ""
echo "🔨 Building..."
if [ "$DRY_RUN" = true ]; then
  echo "   [dry-run] Would run: bun run build"
else
  bun run build 2>&1 | sed 's/^/   /'
  echo "   ✓ Build complete"
fi

# ─── Publish ──────────────────────────────────────────────────────────────────

echo ""
published=0
skipped=0
failed=0

for pkg_dir in packages/*/; do
  pkg_json="$pkg_dir/package.json"
  [ -f "$pkg_json" ] || continue

  name=$(jq -r '.name' "$pkg_json")
  version=$(jq -r '.version' "$pkg_json")
  is_private=$(jq -r '.private // false' "$pkg_json")

  # Skip private packages
  if [ "$is_private" = "true" ]; then
    echo "⏭️  $name (private) — skipped"
    ((skipped++))
    continue
  fi

  # Check if this exact version is already published (unless --force)
  if [ "$FORCE" = false ]; then
    remote_version=$(npm view "$name" version --registry "$REGISTRY" 2>/dev/null || echo "")
    if [ "$remote_version" = "$version" ]; then
      echo "⏭️  $name@$version — already published"
      ((skipped++))
      continue
    fi
  fi

  if [ "$DRY_RUN" = true ]; then
    echo "📤 [dry-run] Would publish $name@$version"
    ((published++))
  else
    echo "📤 Publishing $name@$version..."
    if (cd "$pkg_dir" && npm publish --registry "$REGISTRY" 2>&1 | sed 's/^/   /'); then
      ((published++))
    else
      echo "   ⚠️  Failed to publish $name@$version"
      ((failed++))
    fi
  fi
done

# ─── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
prefix=""
[ "$DRY_RUN" = true ] && prefix="[dry-run] "
echo "${prefix}✅ Published: $published  ⏭️ Skipped: $skipped  ❌ Failed: $failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$DRY_RUN" = false ] && [ "$published" -gt 0 ] && [ ${#CHANGESETS[@]} -gt 0 ]; then
  echo ""
  echo "💡 Don't forget to commit the version bumps:"
  echo "   git add -A && git commit -m 'chore: version packages (local)'"
fi

exit $failed

#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Version with changesets and publish @dreki-gg/* packages to the local Verdaccio registry.

.EXAMPLE
  ./scripts/deploy-local.ps1            # version + publish changed packages
  ./scripts/deploy-local.ps1 -Force     # republish all public packages (even unchanged)
  ./scripts/deploy-local.ps1 -DryRun    # show what would be published without doing it
#>
[CmdletBinding()]
param(
  [switch]$Force,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$Registry = 'http://127.0.0.1:4873'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
Set-Location $Root

# --- Preflight -----------------------------------------------------------------
Write-Host "Checking Verdaccio at $Registry..." -ForegroundColor Cyan
try {
  Invoke-WebRequest -Uri $Registry -UseBasicParsing -TimeoutSec 3 | Out-Null
  Write-Host "  Verdaccio is up" -ForegroundColor Green
} catch {
  Write-Error "Verdaccio is not running at $Registry. Start it: ./scripts/local-registry.ps1 start"
}

# --- Consume changesets -> bump versions ---------------------------------------
$changesets = @(Get-ChildItem -Path (Join-Path $Root '.changeset') -Filter '*.md' -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -ne 'README.md' })

if ($changesets.Count -gt 0) {
  Write-Host ""
  Write-Host "Found $($changesets.Count) changeset(s):"
  $changesets | ForEach-Object { Write-Host "   - $($_.BaseName)" }
  Write-Host ""
  if ($DryRun) {
    Write-Host "[dry-run] Would run: changeset version"
  } else {
    Write-Host "Applying changeset versions..." -ForegroundColor Cyan
    npx changeset version
    if ($LASTEXITCODE -ne 0) { Write-Error "changeset version failed" }
    Write-Host "  Versions bumped" -ForegroundColor Green
  }
} else {
  Write-Host ""
  Write-Host "No pending changesets."
  if (-not $Force) {
    Write-Host "  Nothing to version. Use -Force to republish all packages anyway."
  }
}

# --- Build ---------------------------------------------------------------------
Write-Host ""
Write-Host "Building..." -ForegroundColor Cyan
if ($DryRun) {
  Write-Host "  [dry-run] Would run: bun run build"
} else {
  bun run build
  if ($LASTEXITCODE -ne 0) { Write-Error "build failed" }
  Write-Host "  Build complete" -ForegroundColor Green
}

# --- Publish -------------------------------------------------------------------
Write-Host ""
$published = 0; $skipped = 0; $failed = 0

foreach ($pkgDir in (Get-ChildItem -Path (Join-Path $Root 'packages') -Directory)) {
  $pkgJson = Join-Path $pkgDir.FullName 'package.json'
  if (-not (Test-Path $pkgJson)) { continue }

  $pkg = Get-Content $pkgJson -Raw | ConvertFrom-Json
  $name = $pkg.name
  $version = $pkg.version
  $isPrivate = [bool]$pkg.private

  if ($isPrivate) {
    Write-Host "skip  $name (private)" -ForegroundColor DarkGray
    $skipped++; continue
  }

  if (-not $Force) {
    $remote = $(try { npm view $name version --registry $Registry 2>$null } catch { $null })
    if ($remote -and ("$remote".Trim() -eq $version)) {
      Write-Host "skip  $name@$version (already published)" -ForegroundColor DarkGray
      $skipped++; continue
    }
  }

  if ($DryRun) {
    Write-Host "[dry-run] Would publish $name@$version" -ForegroundColor Cyan
    $published++
  } else {
    Write-Host "Publishing $name@$version..." -ForegroundColor Cyan
    Push-Location $pkgDir.FullName
    npm publish --registry $Registry
    $ok = ($LASTEXITCODE -eq 0)
    Pop-Location
    if ($ok) { $published++ } else { Write-Host "  Failed: $name@$version" -ForegroundColor Red; $failed++ }
  }
}

# --- Summary -------------------------------------------------------------------
Write-Host ""
Write-Host "-----------------------------------"
$prefix = if ($DryRun) { "[dry-run] " } else { "" }
Write-Host "${prefix}Published: $published  Skipped: $skipped  Failed: $failed"
Write-Host "-----------------------------------"

if (-not $DryRun -and $published -gt 0 -and $changesets.Count -gt 0) {
  Write-Host ""
  Write-Host "Don't forget to commit the version bumps:"
  Write-Host "   git add -A && git commit -m 'chore: version packages (local)'"
}

exit $failed

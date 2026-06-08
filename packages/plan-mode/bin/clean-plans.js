#!/usr/bin/env node
/**
 * CLI to clean closed plans (and initiatives) from `.plans/`.
 *
 * Usage:
 *   npx @dreki-gg/pi-plan-mode clean [--dry-run] [--purge]
 *
 * Reads `.plans/plans.jsonl` and `.plans/initiatives.jsonl`, and for every
 * entry whose status is terminal (done / superseded / abandoned):
 *   - default:  ARCHIVES the directory to `.plans/.archive/<name>/`
 *               (non-destructive — keeps HANDOFF.md / INITIATIVE.md as a record)
 *   - --purge:  permanently deletes the directory
 * In both cases the entry is removed from its active registry.
 *
 * Designed for use in GitHub Actions after merge — similar to changesets.
 * History-preserving by default (FEEDBACK #4): closing out a finished plan must
 * not silently destroy its handoff + task ledger.
 */

import { readFileSync, writeFileSync, rmSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const PLANS_DIR = '.plans';
const ARCHIVE_DIR = join(PLANS_DIR, '.archive');
const PLANS_MANIFEST = join(PLANS_DIR, 'plans.jsonl');
const INITIATIVES_MANIFEST = join(PLANS_DIR, 'initiatives.jsonl');

const TERMINAL_STATUSES = new Set(['done', 'superseded', 'abandoned']);

/** Parse a `.jsonl` registry into an array of entries. */
function readManifest(path, label) {
  const text = readFileSync(path, 'utf-8');
  const entries = [];
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    if (!raw.trim()) continue;
    try {
      entries.push(JSON.parse(raw));
    } catch (err) {
      console.error(`Failed to parse ${label} at line ${index + 1}:`, err);
      process.exit(1);
    }
  }
  return entries;
}

function writeManifest(path, entries) {
  const content =
    entries.map((entry) => JSON.stringify(entry)).join('\n') + (entries.length ? '\n' : '');
  writeFileSync(path, content);
}

/**
 * Clean one registry. `noun` is "plan" / "initiative" for messaging. Returns
 * the number cleaned and how many remain in progress.
 */
function cleanRegistry(manifestRelPath, noun, { dryRun, purge }) {
  const manifestPath = resolve(manifestRelPath);
  if (!existsSync(manifestPath)) return { cleaned: 0, inFlight: 0, closed: 0 };

  const entries = readManifest(manifestPath, manifestRelPath);
  const closed = entries.filter((entry) => TERMINAL_STATUSES.has(entry.status));
  const inFlight = entries.filter((entry) => entry.status === 'in-progress');

  if (closed.length === 0) {
    console.log(`No closed ${noun}s to clean.`);
    if (inFlight.length > 0) {
      console.log(`  ${inFlight.length} ${noun}(s) still in progress.`);
    }
    return { cleaned: 0, inFlight: inFlight.length, closed: 0 };
  }

  const verb = purge ? 'delete' : 'archive';
  console.log(
    dryRun
      ? `Dry run — would ${verb} closed ${noun}s:\n`
      : `${purge ? 'Deleting' : 'Archiving'} closed ${noun}s:\n`,
  );

  if (!dryRun && !purge && !existsSync(resolve(ARCHIVE_DIR))) {
    mkdirSync(resolve(ARCHIVE_DIR), { recursive: true });
  }

  const remaining = [...inFlight];
  let cleaned = 0;
  for (const entry of closed) {
    const dirPath = resolve(join(PLANS_DIR, entry.name));
    const exists = existsSync(dirPath);
    const label = `${entry.name} — ${entry.title} [${entry.status}]`;

    if (dryRun) {
      console.log(`  ✓ ${label}${exists ? '' : ' (directory already missing)'}`);
      continue;
    }

    if (exists) {
      if (purge) {
        rmSync(dirPath, { recursive: true, force: true });
        console.log(`  ✓ Deleted ${PLANS_DIR}/${entry.name} — ${label}`);
      } else {
        const dest = resolve(join(ARCHIVE_DIR, entry.name));
        rmSync(dest, { recursive: true, force: true }); // replace any stale archive
        renameSync(dirPath, dest);
        console.log(`  ✓ Archived ${PLANS_DIR}/${entry.name} → ${ARCHIVE_DIR}/${entry.name}`);
      }
    } else {
      console.log(`  ✓ ${entry.name} — directory already missing, removing from manifest`);
    }
    cleaned++;
  }

  if (dryRun) {
    console.log(`\n${closed.length} ${noun}(s) would be cleaned.`);
    if (inFlight.length > 0) {
      console.log(`${inFlight.length} ${noun}(s) still in progress (will be kept).`);
    }
    return { cleaned: 0, inFlight: inFlight.length, closed: closed.length };
  }

  if (remaining.length === 0) {
    rmSync(manifestPath, { force: true });
  } else {
    writeManifest(manifestPath, remaining);
  }

  console.log(`\nCleaned ${cleaned} ${noun}(s).`);
  if (remaining.length > 0) console.log(`${remaining.length} ${noun}(s) still in progress.`);
  return { cleaned, inFlight: remaining.length, closed: closed.length };
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command !== 'clean') {
    console.error('Usage: pi-plan-mode clean [--dry-run] [--purge]\n');
    console.error('Commands:');
    console.error('  clean       Archive closed plan + initiative directories and update registries\n');
    console.error('Options:');
    console.error('  --dry-run   Show what would be cleaned without changing anything');
    console.error('  --purge     Permanently delete instead of archiving to .plans/.archive/');
    process.exit(1);
  }

  const dryRun = args.includes('--dry-run');
  const purge = args.includes('--purge');

  if (!existsSync(resolve(PLANS_MANIFEST)) && !existsSync(resolve(INITIATIVES_MANIFEST))) {
    console.log(`No ${PLANS_MANIFEST} or ${INITIATIVES_MANIFEST} found — nothing to clean.`);
    process.exit(0);
  }

  const plans = cleanRegistry(PLANS_MANIFEST, 'plan', { dryRun, purge });
  console.log('');
  const initiatives = cleanRegistry(INITIATIVES_MANIFEST, 'initiative', { dryRun, purge });

  if (!dryRun && !purge && (plans.cleaned > 0 || initiatives.cleaned > 0)) {
    console.log(`\nArchived items kept in ${ARCHIVE_DIR}/ (use --purge to delete).`);
  }
}

main();

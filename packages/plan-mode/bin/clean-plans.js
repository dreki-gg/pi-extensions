#!/usr/bin/env node
/**
 * CLI to clean closed plans from `.plans/`.
 *
 * Usage:
 *   npx @dreki-gg/pi-plan-mode clean [--dry-run] [--purge]
 *
 * Reads `.plans/plans.jsonl`, and for every plan whose status is terminal
 * (done / superseded / abandoned):
 *   - default:  ARCHIVES the plan directory to `.plans/.archive/<name>/`
 *               (non-destructive — keeps HANDOFF.md + tasks.jsonl as a record)
 *   - --purge:  permanently deletes the plan directory
 * In both cases the entry is removed from the active `plans.jsonl` registry.
 *
 * Designed for use in GitHub Actions after merge — similar to changesets.
 * History-preserving by default (FEEDBACK #4): closing out a finished plan must
 * not silently destroy its handoff + task ledger.
 */

import { readFileSync, writeFileSync, rmSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const PLANS_DIR = '.plans';
const ARCHIVE_DIR = join(PLANS_DIR, '.archive');
const MANIFEST_PATH = join(PLANS_DIR, 'plans.jsonl');

const TERMINAL_STATUSES = new Set(['done', 'superseded', 'abandoned']);

/** Parse `.plans/plans.jsonl` into an array of plan entries. */
function readManifest(path) {
  const text = readFileSync(path, 'utf-8');
  const entries = [];
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    if (!raw.trim()) continue;
    try {
      entries.push(JSON.parse(raw));
    } catch (err) {
      console.error(`Failed to parse ${MANIFEST_PATH} at line ${index + 1}:`, err);
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

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command !== 'clean') {
    console.error('Usage: pi-plan-mode clean [--dry-run] [--purge]\n');
    console.error('Commands:');
    console.error('  clean       Archive closed plan directories and update plans.jsonl\n');
    console.error('Options:');
    console.error('  --dry-run   Show what would be cleaned without changing anything');
    console.error('  --purge     Permanently delete instead of archiving to .plans/.archive/');
    process.exit(1);
  }

  const dryRun = args.includes('--dry-run');
  const purge = args.includes('--purge');
  const manifestPath = resolve(MANIFEST_PATH);

  if (!existsSync(manifestPath)) {
    console.log(`No ${MANIFEST_PATH} found — nothing to clean.`);
    process.exit(0);
  }

  const entries = readManifest(manifestPath);
  const closed = entries.filter((entry) => TERMINAL_STATUSES.has(entry.status));
  const inFlight = entries.filter((entry) => entry.status === 'in-progress');

  if (closed.length === 0) {
    console.log('No closed plans to clean.');
    if (inFlight.length > 0) {
      console.log(`\n${inFlight.length} plan(s) still in progress:`);
      for (const entry of inFlight) console.log(`  ○ ${entry.name} — ${entry.title}`);
    }
    process.exit(0);
  }

  const verb = purge ? 'delete' : 'archive';
  console.log(
    dryRun ? `Dry run — would ${verb}:\n` : `${purge ? 'Deleting' : 'Archiving'} closed plans:\n`,
  );

  if (!dryRun && !purge && !existsSync(resolve(ARCHIVE_DIR))) {
    mkdirSync(resolve(ARCHIVE_DIR), { recursive: true });
  }

  const remaining = [...inFlight];
  let cleaned = 0;
  for (const entry of closed) {
    const planPath = resolve(join(PLANS_DIR, entry.name));
    const exists = existsSync(planPath);
    const label = `${entry.name} — ${entry.title} [${entry.status}]`;

    if (dryRun) {
      console.log(`  ✓ ${label}${exists ? '' : ' (directory already missing)'}`);
      continue;
    }

    if (exists) {
      if (purge) {
        rmSync(planPath, { recursive: true, force: true });
        console.log(`  ✓ Deleted ${PLANS_DIR}/${entry.name} — ${label}`);
      } else {
        const dest = resolve(join(ARCHIVE_DIR, entry.name));
        rmSync(dest, { recursive: true, force: true }); // replace any stale archive
        renameSync(planPath, dest);
        console.log(`  ✓ Archived ${PLANS_DIR}/${entry.name} → ${ARCHIVE_DIR}/${entry.name}`);
      }
    } else {
      console.log(`  ✓ ${entry.name} — directory already missing, removing from manifest`);
    }
    cleaned++;
  }

  if (dryRun) {
    console.log(`\n${closed.length} plan(s) would be cleaned.`);
    if (inFlight.length > 0) {
      console.log(`${inFlight.length} plan(s) still in progress (will be kept).`);
    }
    return;
  }

  if (remaining.length === 0) {
    rmSync(manifestPath, { force: true });
  } else {
    writeManifest(manifestPath, remaining);
  }

  console.log(`\nCleaned ${cleaned} plan(s).`);
  if (remaining.length > 0) console.log(`${remaining.length} plan(s) still in progress.`);
  if (!purge) console.log(`Archived plans kept in ${ARCHIVE_DIR}/ (use --purge to delete).`);
}

main();

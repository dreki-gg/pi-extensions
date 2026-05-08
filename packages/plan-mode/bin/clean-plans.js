#!/usr/bin/env node
/**
 * CLI to clean completed plans from `.plans/`.
 *
 * Usage:
 *   npx @dreki-gg/pi-plan-mode clean [--dry-run]
 *
 * Reads `.plans/plans.json`, deletes directories for plans with status "done",
 * and updates `plans.json` to remove them.
 *
 * Designed for use in GitHub Actions after merge — similar to changesets.
 */

import { readFileSync, writeFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const PLANS_DIR = '.plans';
const PLANS_JSON = join(PLANS_DIR, 'plans.json');

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command !== 'clean') {
    console.error('Usage: pi-plan-mode clean [--dry-run]\n');
    console.error('Commands:');
    console.error('  clean       Remove completed plan directories and update plans.json\n');
    console.error('Options:');
    console.error('  --dry-run   Show what would be deleted without actually deleting');
    process.exit(1);
  }

  const dryRun = args.includes('--dry-run');
  const plansJsonPath = resolve(PLANS_JSON);

  if (!existsSync(plansJsonPath)) {
    console.log('No .plans/plans.json found — nothing to clean.');
    process.exit(0);
  }

  /** @type {Record<string, { status: string; title: string; created: string; completed: string | null }>} */
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(plansJsonPath, 'utf-8'));
  } catch (err) {
    console.error(`Failed to parse ${PLANS_JSON}:`, err);
    process.exit(1);
  }

  const donePlans = Object.entries(manifest).filter(([, entry]) => entry.status === 'done');
  const inFlightPlans = Object.entries(manifest).filter(
    ([, entry]) => entry.status === 'in-progress',
  );

  if (donePlans.length === 0) {
    console.log('No completed plans to clean.');
    if (inFlightPlans.length > 0) {
      console.log(`\n${inFlightPlans.length} plan(s) still in progress:`);
      for (const [name, entry] of inFlightPlans) {
        console.log(`  ○ ${name} — ${entry.title}`);
      }
    }
    process.exit(0);
  }

  console.log(dryRun ? 'Dry run — would clean:\n' : 'Cleaning completed plans:\n');

  let cleaned = 0;
  for (const [name, entry] of donePlans) {
    const planPath = resolve(join(PLANS_DIR, name));
    const exists = existsSync(planPath);

    if (dryRun) {
      console.log(`  ✓ ${name} — ${entry.title}${exists ? '' : ' (directory already missing)'}`);
    } else {
      if (exists) {
        rmSync(planPath, { recursive: true, force: true });
        console.log(`  ✓ Deleted ${PLANS_DIR}/${name} — ${entry.title}`);
      } else {
        console.log(`  ✓ ${name} — directory already missing, removing from manifest`);
      }
      delete manifest[name];
      cleaned++;
    }
  }

  if (!dryRun) {
    const remaining = Object.keys(manifest).length;
    if (remaining === 0) {
      rmSync(plansJsonPath, { force: true });
      // Remove .plans/ if completely empty
      const plansDir = resolve(PLANS_DIR);
      try {
        if (existsSync(plansDir) && readdirSync(plansDir).length === 0) {
          rmSync(plansDir, { recursive: true, force: true });
          console.log(`\nRemoved empty ${PLANS_DIR}/`);
        }
      } catch {
        // Directory might have other contents
      }
    } else {
      writeFileSync(plansJsonPath, JSON.stringify(manifest, null, 2) + '\n');
    }

    console.log(`\nCleaned ${cleaned} plan(s).`);
    if (remaining > 0) {
      console.log(`${remaining} plan(s) still in progress.`);
    }
  } else {
    console.log(`\n${donePlans.length} plan(s) would be cleaned.`);
    if (inFlightPlans.length > 0) {
      console.log(`${inFlightPlans.length} plan(s) still in progress (will be kept).`);
    }
  }
}

main();

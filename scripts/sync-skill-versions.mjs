#!/usr/bin/env node
/**
 * Sync `library_version` in every packages/<pkg>/skills/**\/SKILL.md to its
 * owning package's current version.
 *
 * Runs after `changeset version` (see the root "version" script) so a bumped
 * package's TanStack Intent skill never reports a stale `library_version`
 * (which `intent stale` would otherwise flag).
 *
 * Only the frontmatter `library_version:` line is touched; skills without that
 * field are skipped.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGES_DIR = 'packages';
const LIBRARY_VERSION_RE = /^(\s*library_version:\s*)["']?[^"'\n]+["']?\s*$/m;

/** Recursively collect SKILL.md paths under a directory. */
function findSkillFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findSkillFiles(full));
    else if (entry.name === 'SKILL.md') out.push(full);
  }
  return out;
}

let updated = 0;
let skipped = 0;

for (const pkg of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
  if (!pkg.isDirectory()) continue;
  const pkgDir = join(PACKAGES_DIR, pkg.name);
  const skillsDir = join(pkgDir, 'skills');
  const pkgJsonPath = join(pkgDir, 'package.json');
  if (!existsSync(skillsDir) || !existsSync(pkgJsonPath)) continue;

  const version = JSON.parse(readFileSync(pkgJsonPath, 'utf-8')).version;
  if (!version) continue;

  for (const skill of findSkillFiles(skillsDir)) {
    const content = readFileSync(skill, 'utf-8');
    if (!LIBRARY_VERSION_RE.test(content)) continue;
    const next = content.replace(LIBRARY_VERSION_RE, `$1"${version}"`);
    if (next === content) {
      skipped += 1;
      continue;
    }
    writeFileSync(skill, next);
    updated += 1;
    console.log(`synced ${skill} → library_version "${version}"`);
  }
}

console.log(`sync-skill-versions: ${updated} updated, ${skipped} already current.`);

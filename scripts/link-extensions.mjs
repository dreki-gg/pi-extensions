#!/usr/bin/env node
/**
 * Symlink self-contained extensions into the local pi user folder for a
 * live-edit dev loop (no publish, no `pi update`). Cross-platform: uses a
 * "file" symlink on Unix and Windows alike, falling back to a hard copy on
 * Windows when symlink creation is denied (no Developer Mode / admin).
 *
 * Granular by design: you must name the packages, or pass --all opt-in.
 *
 *   node scripts/link-extensions.mjs link ast-grep handoff
 *   node scripts/link-extensions.mjs link --all
 *   node scripts/link-extensions.mjs unlink workflow
 *   node scripts/link-extensions.mjs list
 *
 * Only link single-file extensions with no relative imports or runtime deps —
 * packages with many files or dependencies must be installed via Verdaccio.
 */

import { existsSync, lstatSync, mkdirSync, copyFileSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES_DIR = join(ROOT, 'packages');
const DEFAULT_TARGET = join(homedir(), '.pi', 'agent', 'extensions');

/** Every package directory that declares pi.extensions. */
function allPackages() {
  return readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => {
      const m = join(PACKAGES_DIR, name, 'package.json');
      if (!existsSync(m)) return false;
      const pkg = JSON.parse(readFileSync(m, 'utf8'));
      return (pkg.pi?.extensions ?? []).length > 0;
    });
}

/** Resolve a pi.extensions entry (dir -> index.ts, or a file) to a .ts file. */
function resolveEntry(pkgDir, entry) {
  const base = resolve(pkgDir, entry);
  if (existsSync(base) && lstatSync(base).isDirectory()) return join(base, 'index.ts');
  if (existsSync(base)) return base;
  if (existsSync(`${base}.ts`)) return `${base}.ts`;
  return join(base, 'index.ts'); // best effort; reported as missing on use
}

/** Collect { name, source } link targets for the named packages. */
function collectTargets(names) {
  const out = [];
  for (const name of names) {
    const pkgDir = join(PACKAGES_DIR, name);
    const manifest = join(pkgDir, 'package.json');
    if (!existsSync(manifest)) {
      console.error(`✗ ${name}: no packages/${name}/package.json`);
      continue;
    }
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
    const entries = pkg.pi?.extensions ?? [];
    if (entries.length === 0) console.error(`✗ ${name}: package.json has no pi.extensions`);
    for (const entry of entries) {
      const source = resolveEntry(pkgDir, entry);
      const stem = basename(source, '.ts') === 'index' ? basename(entry) : basename(source, '.ts');
      out.push({ name: `${stem}.ts`, source });
    }
  }
  return out;
}

function isSymlink(p) {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

/** Resolve the package list from CLI args + --all, or exit with guidance. */
function resolvePackages(pkgs, all) {
  if (all) return allPackages();
  if (pkgs.length === 0) {
    console.error('Name one or more packages, or pass --all. Try: link-extensions list');
    process.exit(1);
  }
  return pkgs;
}

function link({ name, source }, { dir, dryRun, force }) {
  if (!existsSync(source)) {
    console.error(`✗ ${name}: source not found (${source})`);
    return;
  }
  const dest = join(dir, name);
  if (dryRun) {
    console.log(`would link ${dest} -> ${source}`);
    return;
  }
  if (existsSync(dest) || isSymlink(dest)) {
    if (!force) {
      console.error(`✗ ${name}: ${dest} exists (use --force to overwrite)`);
      return;
    }
    rmSync(dest, { force: true });
  }
  try {
    symlinkSync(source, dest, 'file');
    console.log(`✓ linked ${name} -> ${source}`);
  } catch (err) {
    if (process.platform === 'win32' && (err.code === 'EPERM' || err.code === 'EACCES')) {
      copyFileSync(source, dest);
      console.warn(`⚠ ${name}: symlink denied, copied instead (no live updates). Enable Developer Mode for symlinks.`);
    } else {
      throw err;
    }
  }
}

function unlink({ name }, { dir, dryRun }) {
  const dest = join(dir, name);
  if (!existsSync(dest) && !isSymlink(dest)) {
    console.log(`· ${name}: nothing to remove`);
    return;
  }
  if (dryRun) {
    console.log(`would remove ${dest}`);
    return;
  }
  rmSync(dest, { force: true });
  console.log(`✓ removed ${dest}`);
}

const program = new Command();
program
  .name('link-extensions')
  .description('Symlink self-contained pi extensions into the user folder for live-edit dev.');

program
  .command('link')
  .description('Symlink named packages (or --all) into the pi user folder')
  .argument('[packages...]', 'package directory names under packages/')
  .option('-a, --all', 'opt in to linking every package that declares pi.extensions', false)
  .option('-f, --force', 'overwrite existing files/links', false)
  .option('-n, --dry-run', 'print actions without changing anything', false)
  .option('-d, --dir <path>', 'target extensions dir', process.env.PI_EXTENSIONS_DIR || DEFAULT_TARGET)
  .action((packages, opts) => {
    const targets = collectTargets(resolvePackages(packages, opts.all));
    if (!opts.dryRun && !existsSync(opts.dir)) mkdirSync(opts.dir, { recursive: true });
    console.log(`Linking ${targets.length} extension(s) in ${opts.dir}\n`);
    for (const t of targets) link(t, opts);
  });

program
  .command('unlink')
  .description('Remove links for named packages (or --all) from the pi user folder')
  .argument('[packages...]', 'package directory names under packages/')
  .option('-a, --all', 'opt in to unlinking every package that declares pi.extensions', false)
  .option('-n, --dry-run', 'print actions without changing anything', false)
  .option('-d, --dir <path>', 'target extensions dir', process.env.PI_EXTENSIONS_DIR || DEFAULT_TARGET)
  .action((packages, opts) => {
    const targets = collectTargets(resolvePackages(packages, opts.all));
    console.log(`Unlinking ${targets.length} extension(s) in ${opts.dir}\n`);
    for (const t of targets) unlink(t, opts);
  });

program
  .command('list')
  .description('List packages that can be linked and their target file names')
  .action(() => {
    for (const name of allPackages()) {
      const files = collectTargets([name]).map((t) => t.name).join(', ');
      console.log(`${name.padEnd(20)} ${files}`);
    }
  });

program.parseAsync();

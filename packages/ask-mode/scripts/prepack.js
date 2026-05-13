#!/usr/bin/env node

/**
 * Prepack script — copies the compiled @dreki-gg/pi-command-sandbox
 * into a local node_modules so npm pack includes it via bundledDependencies.
 *
 * This is needed because bun workspaces hoist deps to the root node_modules/
 * and npm pack only looks at the package-local node_modules/ for bundled deps.
 */

import { cpSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');
const sandboxSrc = resolve(pkgRoot, '..', 'command-sandbox');
const sandboxDest = resolve(pkgRoot, 'node_modules', '@dreki-gg', 'pi-command-sandbox');

mkdirSync(sandboxDest, { recursive: true });
cpSync(resolve(sandboxSrc, 'dist'), resolve(sandboxDest, 'dist'), { recursive: true });
cpSync(resolve(sandboxSrc, 'package.json'), resolve(sandboxDest, 'package.json'));

console.log('✓ Copied @dreki-gg/pi-command-sandbox dist into local node_modules for bundling');

import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  IMPECCABLE_COMMANDS,
  IMPECCABLE_COMMAND_NAMES,
} from '../extensions/impeccable/commands-meta';
import { loadReference } from '../extensions/impeccable/reference';
import { loadProjectContext } from '../extensions/impeccable/context';

describe('commands-meta', () => {
  test('catalogs the design commands and excludes live', () => {
    expect(IMPECCABLE_COMMANDS.length).toBe(22);
    expect(IMPECCABLE_COMMAND_NAMES.has('audit')).toBe(true);
    expect(IMPECCABLE_COMMAND_NAMES.has('critique')).toBe(true);
    expect(IMPECCABLE_COMMAND_NAMES.has('live')).toBe(false);
  });

  test('every command has a category, hint field, and description', () => {
    for (const c of IMPECCABLE_COMMANDS) {
      expect(['Build', 'Evaluate', 'Refine', 'Enhance', 'Fix']).toContain(c.category);
      expect(typeof c.argumentHint).toBe('string');
      expect(c.description.length).toBeGreaterThan(10);
    }
  });
});

describe('loadReference', () => {
  test('returns playbook content for a known command', async () => {
    const ref = await loadReference('audit');
    expect(ref).toBeTruthy();
    expect(ref!.length).toBeGreaterThan(100);
  });

  test('every catalogued command has a bundled reference file', async () => {
    for (const c of IMPECCABLE_COMMANDS) {
      const ref = await loadReference(c.command);
      expect(ref, `missing reference for ${c.command}`).toBeTruthy();
    }
  });

  test('returns null for an unknown command', async () => {
    expect(await loadReference('does-not-exist')).toBeNull();
  });
});

describe('loadProjectContext', () => {
  test('detects PRODUCT.md / DESIGN.md presence at the root', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'impeccable-ctx-'));
    try {
      await writeFile(join(dir, 'PRODUCT.md'), '# Product');
      const ctx = await loadProjectContext(dir);
      expect(ctx.product).toContain('# Product');
      expect(ctx.design).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('returns nulls for a project with no context files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'impeccable-ctx-'));
    try {
      const ctx = await loadProjectContext(dir);
      expect(ctx.product).toBeNull();
      expect(ctx.design).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

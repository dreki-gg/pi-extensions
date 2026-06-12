import { describe, expect, it } from 'bun:test';
import { parseNumstat, parsePorcelain } from '../extensions/stacked-prs/stack/git';
import { planExecution } from '../extensions/stacked-prs/split/executor';
import { proposeSplit } from '../extensions/stacked-prs/split/analyzer';

describe('parsePorcelain', () => {
  it('parses statuses and rename targets', () => {
    const out = ' M src/a.ts\n?? new.ts\nR  old.ts -> renamed.ts';
    const files = parsePorcelain(out);
    expect(files.map((f) => f.path)).toEqual(['src/a.ts', 'new.ts', 'renamed.ts']);
    expect(files[0]!.status).toBe('M');
  });
});

describe('parseNumstat', () => {
  it('sums added and deleted lines', () => {
    expect(parseNumstat('10\t5\tsrc/a.ts\n3\t0\tsrc/b.ts')).toBe(18);
  });
  it('ignores binary (- -) rows', () => {
    expect(parseNumstat('-\t-\timage.png')).toBe(0);
  });
});

describe('planExecution', () => {
  it('chains branches off each other and opens a PR per layer', () => {
    const layers = proposeSplit([
      { path: 'db/schema.sql' },
      { path: 'server/s.ts' },
    ]);
    const steps = planExecution(layers, { trunk: 'main', branchPrefix: 'feat/' });

    const checkouts = steps.filter((s) => s.args[0] === 'checkout');
    expect(checkouts[0]!.args).toEqual(['checkout', '-b', 'feat/layer-schema', 'main']);
    expect(checkouts[1]!.args).toEqual([
      'checkout',
      '-b',
      'feat/layer-backend',
      'feat/layer-schema',
    ]);

    // Each layer pushes and opens a PR against its parent.
    const prCreates = steps.filter((s) => s.command === 'gh' && s.args[1] === 'create');
    expect(prCreates).toHaveLength(2);
    expect(prCreates[0]!.args).toContain('feat/layer-schema');
    expect(prCreates[0]!.args).toContain('main');
    expect(prCreates[1]!.args).toContain('feat/layer-backend');
    expect(prCreates[1]!.args).toContain('feat/layer-schema');
    // No external stack CLI step.
    expect(steps.some((s) => s.command === 'stack')).toBe(false);
  });
});

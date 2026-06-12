import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { detectTargets, formatFindings } from '../extensions/impeccable/detect';

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'impeccable-test-'));
  await writeFile(
    join(dir, 'slop.css'),
    `.card { border-left: 4px solid red; }
.title { background: linear-gradient(90deg,#f00,#00f); -webkit-background-clip: text; color: transparent; }`,
  );
  await writeFile(
    join(dir, 'clean.css'),
    `.card { border: 1px solid #1a1a1a; border-radius: 8px; }`,
  );
  await mkdir(join(dir, 'nested'), { recursive: true });
  await writeFile(
    join(dir, 'nested', 'page.html'),
    `<!doctype html><html><head><style>
body { font-family: Inter, sans-serif; }
.box { border-left: 6px solid #f00; }
</style></head><body><h1>Hi</h1></body></html>`,
  );
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('detectTargets', () => {
  test('flags anti-patterns in a single CSS file', async () => {
    const findings = await detectTargets([join(dir, 'slop.css')]);
    const ids = findings.map((f) => f.antipattern);
    expect(ids).toContain('side-tab');
    expect(ids).toContain('gradient-text');
  });

  test('returns no findings for clean CSS', async () => {
    const findings = await detectTargets([join(dir, 'clean.css')]);
    expect(findings).toHaveLength(0);
  });

  test('routes HTML files through the static-html engine', async () => {
    const findings = await detectTargets([join(dir, 'nested', 'page.html')]);
    const ids = findings.map((f) => f.antipattern);
    expect(ids).toContain('side-tab');
    expect(ids).toContain('overused-font');
  });

  test('recurses into a directory and scans every supported file', async () => {
    const findings = await detectTargets([dir]);
    const files = new Set(findings.map((f) => f.file));
    // slop.css and nested/page.html both contribute; clean.css does not.
    expect([...files].some((f) => f.endsWith('slop.css'))).toBe(true);
    expect([...files].some((f) => f.endsWith('page.html'))).toBe(true);
  });

  test('each finding carries file, antipattern, and description', async () => {
    const [finding] = await detectTargets([join(dir, 'slop.css')]);
    expect(finding.file).toBeTruthy();
    expect(finding.antipattern).toBeTruthy();
    expect(typeof finding.description).toBe('string');
  });

  test('ignores unreadable / missing targets without throwing', async () => {
    const findings = await detectTargets([join(dir, 'does-not-exist.css')]);
    expect(findings).toEqual([]);
  });
});

describe('formatFindings', () => {
  test('groups findings by file and reports a total', async () => {
    const findings = await detectTargets([join(dir, 'slop.css')]);
    const out = formatFindings(findings);
    expect(out).toContain('slop.css');
    expect(out).toMatch(/anti-pattern/);
  });

  test('reports a clean result when there are no findings', () => {
    expect(formatFindings([])).toMatch(/0 anti-patterns|No anti-patterns/i);
  });
});

import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PKG_ROOT = join(import.meta.dir, '..', '..', '..');
const PKG_JSON = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf-8'));

describe('package.json pi manifest', () => {
  test('declares skills directory', () => {
    expect(PKG_JSON.pi?.skills).toBeDefined();
    expect(PKG_JSON.pi.skills).toContain('./skills');
  });
});

describe('bundled technical-options skill', () => {
  const skillDir = join(PKG_ROOT, 'skills', 'technical-options');
  const skillFile = join(skillDir, 'SKILL.md');

  test('SKILL.md exists', () => {
    expect(existsSync(skillFile)).toBe(true);
  });

  test('has valid frontmatter with name and description', () => {
    const content = readFileSync(skillFile, 'utf-8');
    expect(content).toMatch(/^---\n/);
    expect(content).toMatch(/name:\s*technical-options/);
    expect(content).toMatch(/description:/);
  });

  test('description does not contain overly broad triggers', () => {
    const content = readFileSync(skillFile, 'utf-8');
    // These were flagged during review as too broad for routing
    expect(content).not.toMatch(/description:.*help me decide/i);
    expect(content).not.toMatch(/description:.*what are my options/i);
  });

  test('skill content mentions parallel voting agents', () => {
    const content = readFileSync(skillFile, 'utf-8');
    expect(content).toContain('voting');
    expect(content).toContain('parallel');
  });

  test('skill content includes adversarial framing challenge step', () => {
    const content = readFileSync(skillFile, 'utf-8');
    expect(content).toMatch(/challenge.*framing|framing.*challenge/i);
  });
});

describe('bundled visual-prototype skill', () => {
  const skillDir = join(PKG_ROOT, 'skills', 'visual-prototype');
  const skillFile = join(skillDir, 'SKILL.md');

  test('SKILL.md exists', () => {
    expect(existsSync(skillFile)).toBe(true);
  });

  test('has valid frontmatter with name and description', () => {
    const content = readFileSync(skillFile, 'utf-8');
    expect(content).toMatch(/^---\n/);
    expect(content).toMatch(/name:\s*visual-prototype/);
    expect(content).toMatch(/description:/);
  });

  test('routes on visual work, not backend-only', () => {
    const content = readFileSync(skillFile, 'utf-8');
    expect(content).toMatch(/description:.*\b(UI|component|layout|style)\b/i);
    expect(content).toMatch(/not for.*backend|backend-only/i);
  });

  test('directs use of preview_prototype before submit_plan', () => {
    const content = readFileSync(skillFile, 'utf-8');
    expect(content).toContain('preview_prototype');
    expect(content).toContain('submit_plan');
  });
});

describe('bundled planning-context skill', () => {
  const skillDir = join(PKG_ROOT, 'skills', 'planning-context');
  const skillFile = join(skillDir, 'SKILL.md');

  test('SKILL.md exists', () => {
    expect(existsSync(skillFile)).toBe(true);
  });

  test('has valid frontmatter with name and description', () => {
    const content = readFileSync(skillFile, 'utf-8');
    expect(content).toMatch(/^---\n/);
    expect(content).toMatch(/name:\s*planning-context/);
    expect(content).toMatch(/description:/);
  });

  test('covers context.md deliberation sections', () => {
    const content = readFileSync(skillFile, 'utf-8');
    expect(content).toContain('context.md');
    expect(content).toMatch(/discarded options/i);
    expect(content).toMatch(/open questions/i);
  });
});

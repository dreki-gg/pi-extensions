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

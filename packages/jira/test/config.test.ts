import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DEFAULT_VIEW_FIELDS, loadProjectConfig, qualifyKey } from '../extensions/jira/config.js';

const TEST_DIR = join(tmpdir(), 'pi-jira-test-config');

beforeEach(async () => {
  await mkdir(join(TEST_DIR, '.pi'), { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('loadProjectConfig', () => {
  test('returns defaults when no config file exists', async () => {
    const emptyDir = join(tmpdir(), 'pi-jira-test-no-config');
    await mkdir(emptyDir, { recursive: true });
    const config = await loadProjectConfig(emptyDir);
    expect(config.acliPath).toBe('acli');
    expect(config.searchLimit).toBe(25);
    expect(config.viewFields).toBe(DEFAULT_VIEW_FIELDS);
    expect(config.defaultProject).toBeUndefined();
    await rm(emptyDir, { recursive: true, force: true });
  });

  test('parses a valid config file', async () => {
    await writeFile(
      join(TEST_DIR, '.pi', 'jira.json'),
      JSON.stringify({
        acliPath: '/usr/local/bin/acli',
        defaultProject: 'PROJ',
        viewFields: 'summary,status',
        searchLimit: 10,
      }),
    );
    const config = await loadProjectConfig(TEST_DIR);
    expect(config.acliPath).toBe('/usr/local/bin/acli');
    expect(config.defaultProject).toBe('PROJ');
    expect(config.viewFields).toBe('summary,status');
    expect(config.searchLimit).toBe(10);
  });

  test('throws on invalid JSON', async () => {
    await writeFile(join(TEST_DIR, '.pi', 'jira.json'), 'not json');
    await expect(loadProjectConfig(TEST_DIR)).rejects.toThrow('Invalid JSON');
  });

  test('throws on invalid searchLimit', async () => {
    await writeFile(join(TEST_DIR, '.pi', 'jira.json'), JSON.stringify({ searchLimit: 0 }));
    await expect(loadProjectConfig(TEST_DIR)).rejects.toThrow('positive integer');
  });

  test('throws on empty acliPath', async () => {
    await writeFile(join(TEST_DIR, '.pi', 'jira.json'), JSON.stringify({ acliPath: '' }));
    await expect(loadProjectConfig(TEST_DIR)).rejects.toThrow('non-empty string');
  });
});

describe('qualifyKey', () => {
  test('prefixes a bare number with the default project', () => {
    expect(qualifyKey('123', 'PROJ')).toBe('PROJ-123');
  });

  test('leaves an already-qualified key untouched', () => {
    expect(qualifyKey('TEAM-9', 'PROJ')).toBe('TEAM-9');
  });

  test('returns a bare number unchanged when no default project', () => {
    expect(qualifyKey('123')).toBe('123');
  });

  test('trims whitespace', () => {
    expect(qualifyKey('  ABC-1  ')).toBe('ABC-1');
  });
});

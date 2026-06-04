import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { loadDotEnv } from '../extensions/datadog/dotenv.js';

const TMP_DIR = join(import.meta.dirname, '.tmp-dotenv-test');

const origApiKey = process.env.DD_API_KEY;
const origAppKey = process.env.DD_APP_KEY;
const origExtra = process.env.DD_DOTENV_EXTRA;

function restoreEnv() {
  for (const [key, val] of [
    ['DD_API_KEY', origApiKey],
    ['DD_APP_KEY', origAppKey],
    ['DD_DOTENV_EXTRA', origExtra],
  ] as const) {
    if (val !== undefined) process.env[key] = val;
    else delete process.env[key];
  }
}

describe('loadDotEnv', () => {
  beforeEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
    mkdirSync(TMP_DIR, { recursive: true });
    delete process.env.DD_API_KEY;
    delete process.env.DD_APP_KEY;
    delete process.env.DD_DOTENV_EXTRA;
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
    restoreEnv();
  });

  it('returns false when no .env file exists', () => {
    expect(loadDotEnv(TMP_DIR)).toBe(false);
  });

  it('loads variables from a .env file', () => {
    writeFileSync(join(TMP_DIR, '.env'), 'DD_API_KEY=from_file\nDD_APP_KEY=app_from_file\n');
    expect(loadDotEnv(TMP_DIR)).toBe(true);
    expect(process.env.DD_API_KEY).toBe('from_file');
    expect(process.env.DD_APP_KEY).toBe('app_from_file');
  });

  it('does not override variables already set in the environment', () => {
    process.env.DD_API_KEY = 'from_shell';
    writeFileSync(join(TMP_DIR, '.env'), 'DD_API_KEY=from_file\nDD_DOTENV_EXTRA=extra_from_file\n');
    expect(loadDotEnv(TMP_DIR)).toBe(true);
    // Shell value wins...
    expect(process.env.DD_API_KEY).toBe('from_shell');
    // ...but new keys are still filled in.
    expect(process.env.DD_DOTENV_EXTRA).toBe('extra_from_file');
  });
});

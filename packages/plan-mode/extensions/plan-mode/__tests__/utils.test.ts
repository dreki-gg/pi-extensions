import { describe, expect, test } from 'bun:test';
import { isSafeCommand, isPlanPath } from '../utils.js';
import { nextTaskId } from '@dreki-gg/taskman';

describe('nextTaskId', () => {
  test('increments the max numeric suffix', () => {
    expect(nextTaskId(['t-001', 't-002', 't-003'])).toBe('t-004');
  });

  test('uses the max even when ids are unordered or sparse', () => {
    expect(nextTaskId(['t-003', 't-001', 't-010'])).toBe('t-011');
  });

  test('starts at t-001 for an empty plan', () => {
    expect(nextTaskId([])).toBe('t-001');
  });

  test('falls back to count+1 when no ids match the pattern', () => {
    expect(nextTaskId(['setup', 'cleanup'])).toBe('t-003');
  });
});

describe('isSafeCommand', () => {
  // ── Commands that SHOULD be allowed ──────────────────────────────────────
  describe('allowed commands', () => {
    test('mkdir -p .plans/<name>', () => {
      expect(isSafeCommand('mkdir -p .plans/monorepo-src-migration')).toBe(true);
    });

    test('mkdir .plans/<name>', () => {
      expect(isSafeCommand('mkdir .plans/my-plan')).toBe(true);
    });

    test('command with 2>/dev/null stderr redirect', () => {
      expect(
        isSafeCommand(
          'cat .release-please-manifest.json 2>/dev/null; echo "---"; cat release-please-config.json 2>/dev/null',
        ),
      ).toBe(true);
    });

    test('curl with 2>/dev/null pipe chain', () => {
      expect(
        isSafeCommand(
          `curl -sL "https://effect.website/docs/platform/introduction/" 2>/dev/null | grep -oP '(?<=href=")[^"]*' | grep -iE "(http|server|rpc)" | head -20`,
        ),
      ).toBe(true);
    });

    test('curl with 2>/dev/null simple', () => {
      expect(
        isSafeCommand(
          `curl -s "https://raw.githubusercontent.com/Effect-TS/effect/main/packages/platform/README.md" 2>/dev/null | head -100`,
        ),
      ).toBe(true);
    });

    test('simple ls', () => {
      expect(isSafeCommand('ls -la')).toBe(true);
    });

    test('git status', () => {
      expect(isSafeCommand('git status')).toBe(true);
    });

    test('git log', () => {
      expect(isSafeCommand('git log --oneline -10')).toBe(true);
    });

    test('find piped to grep', () => {
      expect(isSafeCommand('find . -name "*.ts" | grep -v node_modules')).toBe(true);
    });

    test('cat piped to head', () => {
      expect(isSafeCommand('cat README.md | head -50')).toBe(true);
    });

    test('rg (ripgrep)', () => {
      expect(isSafeCommand('rg "pattern" src/')).toBe(true);
    });

    test('grep with context', () => {
      expect(isSafeCommand('grep -rn "export" src/ | head -20')).toBe(true);
    });

    test('npm list', () => {
      expect(isSafeCommand('npm list --depth=0')).toBe(true);
    });

    test('curl piped to jq', () => {
      expect(isSafeCommand('curl -s https://api.example.com | jq .name')).toBe(true);
    });
  });

  // ── Commands that SHOULD be blocked ──────────────────────────────────────
  describe('blocked commands', () => {
    test('rm -rf', () => {
      expect(isSafeCommand('rm -rf node_modules')).toBe(false);
    });

    test('mkdir outside .plans/', () => {
      expect(isSafeCommand('mkdir -p src/new-dir')).toBe(false);
    });

    test('stdout redirect to file', () => {
      expect(isSafeCommand('echo "hello" > file.txt')).toBe(false);
    });

    test('append redirect', () => {
      expect(isSafeCommand('echo "hello" >> file.txt')).toBe(false);
    });

    test('git commit', () => {
      expect(isSafeCommand('git commit -m "test"')).toBe(false);
    });

    test('npm install', () => {
      expect(isSafeCommand('npm install lodash')).toBe(false);
    });

    test('mv file', () => {
      expect(isSafeCommand('mv old.ts new.ts')).toBe(false);
    });

    test('sudo anything', () => {
      expect(isSafeCommand('sudo ls')).toBe(false);
    });

    test('cp file', () => {
      expect(isSafeCommand('cp a.ts b.ts')).toBe(false);
    });

    test('touch file', () => {
      expect(isSafeCommand('touch newfile.ts')).toBe(false);
    });
  });

  // ── Help/version commands via command-sandbox ────────────────────────────
  describe('help and version commands', () => {
    test('bun --help is allowed', () => {
      expect(isSafeCommand('bun --help')).toBe(true);
    });

    test('man git is allowed', () => {
      expect(isSafeCommand('man git')).toBe(true);
    });

    test('npm --version is allowed', () => {
      expect(isSafeCommand('npm --version')).toBe(true);
    });

    test('rm --help is still blocked', () => {
      expect(isSafeCommand('rm --help')).toBe(false);
    });
  });
});

describe('isPlanPath', () => {
  test('relative .plans/ path', () => {
    expect(isPlanPath('.plans/my-plan/context.md')).toBe(true);
  });

  test('absolute path containing .plans/', () => {
    expect(isPlanPath('/Users/me/project/.plans/my-plan/context.md')).toBe(true);
  });

  test('just .plans/', () => {
    expect(isPlanPath('.plans/foo')).toBe(true);
  });

  test('windows-style backslashes', () => {
    expect(isPlanPath('.plans\\my-plan\\context.md')).toBe(true);
  });

  test('src/ path is blocked', () => {
    expect(isPlanPath('src/index.ts')).toBe(false);
  });

  test('root file is blocked', () => {
    expect(isPlanPath('README.md')).toBe(false);
  });

  test('package.json is blocked', () => {
    expect(isPlanPath('package.json')).toBe(false);
  });

  test('path with plans but not .plans is blocked', () => {
    expect(isPlanPath('src/plans/something.ts')).toBe(false);
  });

  test('path ending in .plans without slash is blocked', () => {
    expect(isPlanPath('.plans')).toBe(false);
  });
});

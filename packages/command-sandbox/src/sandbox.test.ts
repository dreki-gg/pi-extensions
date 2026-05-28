import { describe, expect, test } from 'bun:test';
import { isSafeCommand } from './sandbox.js';

describe('isSafeCommand', () => {
  // ── Simple commands (existing behavior) ─────────────────────────────────
  describe('simple allowed commands', () => {
    test('ls -la', () => {
      expect(isSafeCommand('ls -la')).toBe(true);
    });

    test('git status', () => {
      expect(isSafeCommand('git status')).toBe(true);
    });

    test('git log', () => {
      expect(isSafeCommand('git log --oneline -10')).toBe(true);
    });

    test('rg (ripgrep)', () => {
      expect(isSafeCommand('rg "pattern" src/')).toBe(true);
    });

    test('npm list', () => {
      expect(isSafeCommand('npm list --depth=0')).toBe(true);
    });

    test('cat file', () => {
      expect(isSafeCommand('cat README.md')).toBe(true);
    });

    test('pwd', () => {
      expect(isSafeCommand('pwd')).toBe(true);
    });

    test('cd directory', () => {
      expect(isSafeCommand('cd src')).toBe(true);
    });
  });

  // ── Simple blocked commands ─────────────────────────────────────────────
  describe('simple blocked commands', () => {
    test('rm -rf', () => {
      expect(isSafeCommand('rm -rf node_modules')).toBe(false);
    });

    test('mkdir outside allowed path', () => {
      expect(isSafeCommand('mkdir -p src/new-dir')).toBe(false);
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

  // ── Piped commands ────────────────────────────────────────────────────────
  describe('piped commands', () => {
    test('find piped to grep', () => {
      expect(isSafeCommand('find . -name "*.ts" | grep -v node_modules')).toBe(true);
    });

    test('cat piped to head', () => {
      expect(isSafeCommand('cat README.md | head -50')).toBe(true);
    });

    test('grep with context piped to head', () => {
      expect(isSafeCommand('grep -rn "export" src/ | head -20')).toBe(true);
    });

    test('curl piped to jq', () => {
      expect(isSafeCommand('curl -s https://api.example.com | jq .name')).toBe(true);
    });

    test('safe pipe to destructive is blocked', () => {
      expect(isSafeCommand('ls | rm -rf')).toBe(false);
    });
  });

  // ── Concatenated commands (&&, ||, ;) — THE FIX ─────────────────────────
  describe('concatenated commands with &&', () => {
    test('cd && ls', () => {
      expect(isSafeCommand('cd packages/foo && ls -la')).toBe(true);
    });

    test('cd && find && grep', () => {
      expect(isSafeCommand('cd src && find . -name "*.ts" && grep -rn "export" .')).toBe(true);
    });

    test('cd && cat piped to head', () => {
      expect(isSafeCommand('cd packages/foo && cat README.md | head -20')).toBe(true);
    });

    test('safe && destructive is blocked', () => {
      expect(isSafeCommand('ls -la && rm -rf node_modules')).toBe(false);
    });

    test('destructive && safe is blocked', () => {
      expect(isSafeCommand('npm install lodash && ls')).toBe(false);
    });

    test('git status && git log', () => {
      expect(isSafeCommand('git status && git log --oneline -5')).toBe(true);
    });

    test('git status && git commit is blocked', () => {
      expect(isSafeCommand('git status && git commit -m "oops"')).toBe(false);
    });
  });

  describe('concatenated commands with ||', () => {
    test('cat || echo fallback', () => {
      expect(isSafeCommand('cat file.txt || echo "not found"')).toBe(true);
    });

    test('cat || rm is blocked', () => {
      expect(isSafeCommand('cat file.txt || rm -rf /')).toBe(false);
    });
  });

  describe('concatenated commands with ;', () => {
    test('ls; pwd', () => {
      expect(isSafeCommand('ls; pwd')).toBe(true);
    });

    test('ls; rm is blocked', () => {
      expect(isSafeCommand('ls; rm -rf /')).toBe(false);
    });
  });

  // ── Redirects ─────────────────────────────────────────────────────────────
  describe('redirects', () => {
    test('stdout redirect is blocked by default', () => {
      expect(isSafeCommand('echo "hello" > file.txt')).toBe(false);
    });

    test('append redirect is blocked by default', () => {
      expect(isSafeCommand('echo "hello" >> file.txt')).toBe(false);
    });

    test('redirects allowed with option', () => {
      expect(isSafeCommand('echo "hello" > file.txt', { allowRedirects: true })).toBe(true);
    });
  });

  // ── Command substitution ──────────────────────────────────────────────────
  describe('command substitution', () => {
    test('$() is blocked', () => {
      expect(isSafeCommand('echo $(rm -rf /)')).toBe(false);
    });

    test('backticks are blocked', () => {
      expect(isSafeCommand('echo `rm -rf /`')).toBe(false);
    });

    test('allowed with option', () => {
      expect(isSafeCommand('echo $(whoami)', { allowCommandSubstitution: true })).toBe(true);
    });
  });

  // ── Subshells ─────────────────────────────────────────────────────────────
  describe('subshells', () => {
    test('safe subshell', () => {
      expect(isSafeCommand('(cd foo && ls)')).toBe(true);
    });

    test('destructive in subshell is blocked', () => {
      expect(isSafeCommand('(cd foo && rm -rf .)')).toBe(false);
    });
  });

  // ── Quoted operators ──────────────────────────────────────────────────────
  describe('quoted operators', () => {
    test('&& inside quotes is not a separator', () => {
      expect(isSafeCommand('echo "hello && world"')).toBe(true);
    });

    test('single quoted && is not a separator', () => {
      expect(isSafeCommand("grep 'a && b' file.txt")).toBe(true);
    });
  });

  // ── Custom options ────────────────────────────────────────────────────────
  describe('SandboxOptions', () => {
    test('allowCommand short-circuits for specific commands', () => {
      expect(
        isSafeCommand('mkdir -p .plans/my-plan', {
          allowCommand: (cmd) => /^\s*mkdir\s+(-p\s+)?\.plans(\/|\\|\s|$)/.test(cmd),
        }),
      ).toBe(true);
    });

    test('extraSafe allows additional patterns', () => {
      expect(
        isSafeCommand('bun test', {
          extraSafe: [/^\s*bun\s+(test|run)/i],
        }),
      ).toBe(true);
    });

    test('extraDestructive blocks additional patterns', () => {
      expect(
        isSafeCommand('curl -X POST https://example.com', {
          extraDestructive: [/\bcurl\s+.*-X\s+(POST|PUT|DELETE)/i],
        }),
      ).toBe(false);
    });
  });

  // ── Help, version, and man commands ──────────────────────────────────────
  describe('help, version, and man commands', () => {
    test('bun --help', () => {
      expect(isSafeCommand('bun --help')).toBe(true);
    });

    test('docker compose --help', () => {
      expect(isSafeCommand('docker compose --help')).toBe(true);
    });

    test('git --help', () => {
      expect(isSafeCommand('git --help')).toBe(true);
    });

    test('bun -h', () => {
      expect(isSafeCommand('bun -h')).toBe(true);
    });

    test('cargo --version', () => {
      expect(isSafeCommand('cargo --version')).toBe(true);
    });

    test('rustc -V', () => {
      expect(isSafeCommand('rustc -V')).toBe(true);
    });

    test('man git', () => {
      expect(isSafeCommand('man git')).toBe(true);
    });

    test('man 3 printf', () => {
      expect(isSafeCommand('man 3 printf')).toBe(true);
    });

    test('help cd', () => {
      expect(isSafeCommand('help cd')).toBe(true);
    });

    test('info coreutils', () => {
      expect(isSafeCommand('info coreutils')).toBe(true);
    });

    test('npm --help', () => {
      expect(isSafeCommand('npm --help')).toBe(true);
    });

    test('bun run --help', () => {
      expect(isSafeCommand('bun run --help')).toBe(true);
    });

    test('rm --help is still blocked (destructive wins)', () => {
      expect(isSafeCommand('rm --help')).toBe(false);
    });

    test('sudo --help is still blocked', () => {
      expect(isSafeCommand('sudo --help')).toBe(false);
    });

    test('mv -h is still blocked', () => {
      expect(isSafeCommand('mv -h')).toBe(false);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────
  describe('edge cases', () => {
    test('empty command is blocked', () => {
      expect(isSafeCommand('')).toBe(false);
    });

    test('whitespace only is blocked', () => {
      expect(isSafeCommand('   ')).toBe(false);
    });

    test('curl with 2>/dev/null pipe chain', () => {
      // 2>/dev/null is parsed as: "2" then {op: ">"} then "/dev/null"
      // This will have hasRedirect=true on the first segment.
      // We need the allowRedirects option or a smarter approach for stderr redirects.
      // For now, this is a known limitation — callers can use allowCommand for specific patterns.
      expect(
        isSafeCommand('curl -sL "https://example.com" 2>/dev/null | head -20', {
          allowCommand: (cmd) => /^\s*curl\b.*2>\/dev\/null/.test(cmd),
        }),
      ).toBe(true);
    });
  });
});

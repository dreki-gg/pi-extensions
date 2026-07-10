import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import { findConfigPath, collectConfigCandidates } from '../src/config/find.js';
import { resolveProjectConfig, ConfigError, formatConfigError } from '../src/config/index.js';
import { resolveAuth } from '../src/auth/resolve.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'firestore-cli-config-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
});

function writeJson(path: string, value: unknown) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

describe('config resolution precedence', () => {
  it('prefers .agents/firestore.json over .pi/firestore.json in the same dir', () => {
    writeJson(join(root, '.agents', 'firestore.json'), {
      projectId: 'from-agents',
      serviceAccountKeyPath: './sa.json',
    });
    writeJson(join(root, '.pi', 'firestore.json'), {
      projectId: 'from-pi',
      serviceAccountKeyPath: './sa.json',
    });

    expect(findConfigPath(root)).toBe(join(root, '.agents', 'firestore.json'));
    const config = resolveProjectConfig(root);
    expect(config.projectId).toBe('from-agents');
  });

  it('falls back to .pi/firestore.json when .agents is absent', () => {
    writeJson(join(root, '.pi', 'firestore.json'), {
      defaultEnvironment: 'staging',
      environments: {
        staging: { projectId: 'stg', serviceAccountKeyPath: './stg.json' },
      },
    });
    const config = resolveProjectConfig(root);
    expect(config.defaultEnvironment).toBe('staging');
    expect(config.projectId).toBe('stg');
  });

  it('walks up from a nested cwd to find .agents config', () => {
    const nested = join(root, 'apps', 'web');
    mkdirSync(nested, { recursive: true });
    writeJson(join(root, '.agents', 'firestore.json'), {
      projectId: 'parent',
      serviceAccountKeyPath: './sa.json',
    });
    expect(findConfigPath(nested)).toBe(join(root, '.agents', 'firestore.json'));
  });

  it('throws an actionable error naming looked-up paths when missing', () => {
    const nested = join(root, 'empty');
    mkdirSync(nested, { recursive: true });
    try {
      resolveProjectConfig(nested);
      throw new Error('expected ConfigError');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const formatted = formatConfigError(err as ConfigError);
      expect(formatted).toContain('.agents/firestore.json');
      expect(formatted).toContain('.pi/firestore.json');
      expect(formatted).not.toContain('at ');
      expect((err as ConfigError).stack).toBeDefined();
      // Message itself must not dump a stack — only the Error object has one.
      expect(formatted.split('\n').some((l) => /^\s+at /.test(l))).toBe(false);
    }
  });

  it('lists candidates from collectConfigCandidates', () => {
    const candidates = collectConfigCandidates(root);
    expect(candidates[0]).toBe(join(root, '.agents', 'firestore.json'));
    expect(candidates[1]).toBe(join(root, '.pi', 'firestore.json'));
  });
});

describe('auth actionable errors', () => {
  it('names the service-account path when the file is missing', () => {
    writeJson(join(root, '.agents', 'firestore.json'), {
      projectId: 'proj',
      serviceAccountKeyPath: './missing-sa.json',
    });
    try {
      resolveAuth(root);
      throw new Error('expected ConfigError');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const formatted = formatConfigError(err as ConfigError);
      expect(formatted).toContain('missing-sa.json');
      expect(formatted).toContain('Failed to read service account');
      expect(formatted.split('\n').some((l) => /^\s+at /.test(l))).toBe(false);
    }
  });

  it('selects --env environment from config', () => {
    writeJson(join(root, '.pi', 'firestore.json'), {
      defaultEnvironment: 'development',
      environments: {
        development: { projectId: 'dev', serviceAccountKeyPath: './dev.json' },
        staging: { projectId: 'stg', serviceAccountKeyPath: './stg.json' },
      },
    });
    writeFileSync(join(root, 'stg.json'), JSON.stringify({ type: 'service_account', project_id: 'stg' }));
    const auth = resolveAuth(root, 'staging');
    expect(auth.environment.projectId).toBe('stg');
  });
});

import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getCredentialStatus,
  loadProjectConfig,
  resolveBoardId,
} from '../extensions/miro/config.js';

const dirs: string[] = [];

async function projectWith(config?: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'miro-cfg-'));
  dirs.push(dir);
  if (config !== undefined) {
    await mkdir(join(dir, '.pi'), { recursive: true });
    await writeFile(join(dir, '.pi', 'miro.json'), config, 'utf-8');
  }
  return dir;
}

afterEach(async () => {
  while (dirs.length > 0) await rm(dirs.pop()!, { recursive: true, force: true });
});

describe('loadProjectConfig', () => {
  test('returns defaults when no config file exists', async () => {
    const config = await loadProjectConfig(await projectWith());
    expect(config.defaultShape).toBe('round_rectangle');
    expect(config.defaultBoardId).toBeUndefined();
  });

  test('reads defaultBoardId and defaultShape', async () => {
    const config = await loadProjectConfig(
      await projectWith('{"defaultBoardId":"abc=","defaultShape":"rectangle"}'),
    );
    expect(config.defaultBoardId).toBe('abc=');
    expect(config.defaultShape).toBe('rectangle');
  });

  test('throws on malformed JSON', async () => {
    await expect(loadProjectConfig(await projectWith('{not json'))).rejects.toThrow('Invalid JSON');
  });

  test('throws when defaultBoardId is not a string', async () => {
    await expect(loadProjectConfig(await projectWith('{"defaultBoardId":42}'))).rejects.toThrow(
      'must be a string',
    );
  });
});

describe('resolveBoardId', () => {
  test('prefers the explicit param', () => {
    expect(resolveBoardId('explicit', { defaultShape: 'rectangle', defaultBoardId: 'cfg' })).toBe(
      'explicit',
    );
  });

  test('falls back to defaultBoardId', () => {
    expect(resolveBoardId(undefined, { defaultShape: 'rectangle', defaultBoardId: 'cfg' })).toBe(
      'cfg',
    );
  });

  test('throws a clear error when no board is available', () => {
    expect(() => resolveBoardId(undefined, { defaultShape: 'rectangle' })).toThrow(
      'No Miro board specified',
    );
    expect(() => resolveBoardId(undefined, null)).toThrow('miro_list_boards');
  });
});

describe('getCredentialStatus', () => {
  test('reflects MIRO_ACCESS_TOKEN presence', () => {
    const original = process.env.MIRO_ACCESS_TOKEN;
    delete process.env.MIRO_ACCESS_TOKEN;
    expect(getCredentialStatus().hasAccessToken).toBe(false);
    process.env.MIRO_ACCESS_TOKEN = 'token';
    expect(getCredentialStatus().hasAccessToken).toBe(true);
    if (original === undefined) delete process.env.MIRO_ACCESS_TOKEN;
    else process.env.MIRO_ACCESS_TOKEN = original;
  });
});

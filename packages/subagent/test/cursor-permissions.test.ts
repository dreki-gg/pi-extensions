import { describe, expect, it } from 'bun:test';
import type { PermissionOption } from '@agentclientprotocol/sdk';
import {
  buildCancelledResponse,
  buildPermissionResponse,
  selectPermissionOption,
} from '../extensions/subagent/cursor/permissions.js';

const opt = (kind: PermissionOption['kind'], optionId: string): PermissionOption => ({
  kind,
  optionId,
  name: optionId,
});

describe('selectPermissionOption', () => {
  it('prefers allow_always', () => {
    const options = [
      opt('reject_once', 'r'),
      opt('allow_once', 'ao'),
      opt('allow_always', 'aa'),
    ];
    expect(selectPermissionOption(options)).toBe('aa');
  });

  it('falls back to allow_once when no allow_always', () => {
    expect(selectPermissionOption([opt('reject_once', 'r'), opt('allow_once', 'ao')])).toBe('ao');
  });

  it('falls back to the first option when no allow kinds', () => {
    expect(selectPermissionOption([opt('reject_once', 'r'), opt('reject_always', 'ra')])).toBe('r');
  });

  it('returns undefined for empty options', () => {
    expect(selectPermissionOption([])).toBeUndefined();
  });
});

describe('response builders', () => {
  it('builds a selected outcome', () => {
    expect(buildPermissionResponse('aa')).toEqual({
      outcome: { outcome: 'selected', optionId: 'aa' },
    });
  });

  it('builds a cancelled outcome', () => {
    expect(buildCancelledResponse()).toEqual({ outcome: { outcome: 'cancelled' } });
  });
});

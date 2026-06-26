import { describe, expect, it } from 'bun:test';
import { parseCursorModel } from '../extensions/subagent/cursor/model.js';

describe('parseCursorModel', () => {
  it('treats undefined/empty as non-cursor', () => {
    expect(parseCursorModel(undefined)).toEqual({ isCursor: false, model: '' });
    expect(parseCursorModel('')).toEqual({ isCursor: false, model: '' });
  });

  it('passes through normal models', () => {
    expect(parseCursorModel('anthropic/claude-sonnet')).toEqual({
      isCursor: false,
      model: 'anthropic/claude-sonnet',
    });
  });

  it('routes cursor:<model> to the cursor backend', () => {
    expect(parseCursorModel('cursor:composer-2.5')).toEqual({
      isCursor: true,
      model: 'composer-2.5',
    });
    expect(parseCursorModel('cursor:gpt-5.2')).toEqual({ isCursor: true, model: 'gpt-5.2' });
  });

  it('defaults bare cursor / empty suffix to composer-2.5', () => {
    expect(parseCursorModel('cursor')).toEqual({ isCursor: true, model: 'composer-2.5' });
    expect(parseCursorModel('cursor:')).toEqual({ isCursor: true, model: 'composer-2.5' });
  });

  it('is case-insensitive on the prefix and trims', () => {
    expect(parseCursorModel('  Cursor:composer-2.5  ')).toEqual({
      isCursor: true,
      model: 'composer-2.5',
    });
  });
});

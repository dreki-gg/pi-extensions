import { describe, expect, test } from 'bun:test';
import { formatLifecycleMessage, formatWakeMessage } from '../extensions/pr-babysitter/watcher/message';

describe('formatLifecycleMessage', () => {
  test('distinguishes merged from closed', () => {
    expect(formatLifecycleMessage(7, 'MERGED')).toContain('has been merged');
    expect(formatLifecycleMessage(7, 'CLOSED')).toContain('closed without merging');
  });
});

describe('formatWakeMessage', () => {
  test('renders failed checks and comments with the observe-only footer', () => {
    const text = formatWakeMessage(
      {
        newFailedChecks: [{ name: 'build', bucket: 'fail', link: 'http://ci/1' }],
        newComments: [{ id: 'inline:1', author: 'cursor[bot]', body: 'null deref', kind: 'inline' }],
      },
      7,
    );
    expect(text).toContain('🍼 PR #7 babysitter — new activity:');
    expect(text).toContain('❌ Check failed: `build` — http://ci/1');
    expect(text).toContain('💬 @cursor[bot] (inline): "null deref"');
    expect(text).toContain('Observe-only:');
  });

  test('collapses whitespace and truncates long bodies', () => {
    const long = 'x '.repeat(400);
    const text = formatWakeMessage(
      { newFailedChecks: [], newComments: [{ id: 'review:1', author: 'a', body: long, kind: 'review' }] },
      1,
    );
    expect(text).toContain('…');
    expect(text).not.toContain('\n\nx');
  });
});

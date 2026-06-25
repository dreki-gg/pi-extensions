import { describe, expect, test } from 'bun:test';
import { openUrlCommand } from '../extensions/pr-canvas/open-url';

const URL = 'http://localhost:3000/pr/42';

describe('openUrlCommand', () => {
  test('uses `open` on macOS', () => {
    expect(openUrlCommand(URL, 'darwin')).toEqual({ command: 'open', args: [URL] });
  });

  test('uses `cmd /c start` on Windows (no xdg-open)', () => {
    expect(openUrlCommand(URL, 'win32')).toEqual({
      command: 'cmd',
      args: ['/c', 'start', '', URL],
    });
  });

  test('uses `xdg-open` on Linux and other platforms', () => {
    expect(openUrlCommand(URL, 'linux')).toEqual({ command: 'xdg-open', args: [URL] });
    expect(openUrlCommand(URL, 'freebsd')).toEqual({ command: 'xdg-open', args: [URL] });
  });
});

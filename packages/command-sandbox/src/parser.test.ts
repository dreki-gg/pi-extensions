import { describe, expect, test } from 'bun:test';
import { hasCommandSubstitution, parseCommandSegments } from './parser.js';

describe('parseCommandSegments', () => {
  describe('simple commands', () => {
    test('single command', () => {
      const result = parseCommandSegments('ls -la');
      expect(result).toEqual([{ command: 'ls -la', hasRedirect: false }]);
    });

    test('empty string returns empty array', () => {
      expect(parseCommandSegments('')).toEqual([]);
    });
  });

  describe('&& operator', () => {
    test('splits on &&', () => {
      const result = parseCommandSegments('cd foo && ls -la');
      expect(result).toEqual([
        { command: 'cd foo', hasRedirect: false },
        { command: 'ls -la', hasRedirect: false },
      ]);
    });

    test('three commands with &&', () => {
      const result = parseCommandSegments('cd foo && ls && pwd');
      expect(result).toEqual([
        { command: 'cd foo', hasRedirect: false },
        { command: 'ls', hasRedirect: false },
        { command: 'pwd', hasRedirect: false },
      ]);
    });
  });

  describe('|| operator', () => {
    test('splits on ||', () => {
      const result = parseCommandSegments('cat file || echo fallback');
      expect(result).toEqual([
        { command: 'cat file', hasRedirect: false },
        { command: 'echo fallback', hasRedirect: false },
      ]);
    });
  });

  describe('; operator', () => {
    test('splits on ;', () => {
      const result = parseCommandSegments('ls; pwd');
      expect(result).toEqual([
        { command: 'ls', hasRedirect: false },
        { command: 'pwd', hasRedirect: false },
      ]);
    });
  });

  describe('| pipe', () => {
    test('splits on pipe', () => {
      const result = parseCommandSegments('ls | grep foo');
      expect(result).toEqual([
        { command: 'ls', hasRedirect: false },
        { command: 'grep foo', hasRedirect: false },
      ]);
    });

    test('pipe chain with &&', () => {
      const result = parseCommandSegments('ls | grep foo && echo done');
      expect(result).toEqual([
        { command: 'ls', hasRedirect: false },
        { command: 'grep foo', hasRedirect: false },
        { command: 'echo done', hasRedirect: false },
      ]);
    });
  });

  describe('quotes', () => {
    test('&& inside double quotes is preserved', () => {
      const result = parseCommandSegments('echo "hello && world"');
      expect(result).toEqual([{ command: 'echo hello && world', hasRedirect: false }]);
    });

    test('&& inside single quotes is preserved', () => {
      const result = parseCommandSegments("echo 'hello && world'");
      expect(result).toEqual([{ command: 'echo hello && world', hasRedirect: false }]);
    });
  });

  describe('redirects', () => {
    test('stdout redirect is flagged', () => {
      const result = parseCommandSegments('echo hello > file.txt');
      expect(result).toEqual([{ command: 'echo hello > file.txt', hasRedirect: true }]);
    });

    test('append redirect is flagged', () => {
      const result = parseCommandSegments('echo hello >> file.txt');
      expect(result).toEqual([{ command: 'echo hello >> file.txt', hasRedirect: true }]);
    });
  });

  describe('subshells', () => {
    test('parens are stripped, inner commands validated', () => {
      const result = parseCommandSegments('(cd foo && ls)');
      expect(result).toEqual([
        { command: 'cd foo', hasRedirect: false },
        { command: 'ls', hasRedirect: false },
      ]);
    });
  });
});

describe('hasCommandSubstitution', () => {
  test('$() is detected', () => {
    expect(hasCommandSubstitution('echo $(whoami)')).toBe(true);
  });

  test('backticks are detected', () => {
    expect(hasCommandSubstitution('echo `whoami`')).toBe(true);
  });

  test('normal commands are clean', () => {
    expect(hasCommandSubstitution('ls -la && pwd')).toBe(false);
  });

  test('dollar sign without parens is clean', () => {
    expect(hasCommandSubstitution('echo $HOME')).toBe(false);
  });
});

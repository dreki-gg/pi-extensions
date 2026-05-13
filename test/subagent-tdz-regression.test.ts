/**
 * Regression test for TDZ bug in subagent callbacks.
 *
 * Previously, `runSingleAgent` used `const spawnResult = await spawnPiAgent({...})`
 * and referenced `spawnResult` inside the `onMessage`/`onToolResult` callbacks.
 * Since callbacks fire *during* the await (before the const is assigned),
 * this caused: "ReferenceError: Cannot access 'spawnResult' before initialization"
 *
 * Fix: use `let spawnResult` with a guard (`if (!spawnResult)`) in callbacks.
 *
 * This test ensures:
 * 1. The source code uses `let spawnResult` (not `const spawnResult`)
 * 2. Callbacks guard with `if (!spawnResult)` before accessing
 * 3. The pattern itself doesn't throw when callbacks fire before assignment
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SUBAGENT_INDEX = path.resolve(
  import.meta.dirname,
  '..',
  'packages',
  'subagent',
  'extensions',
  'subagent',
  'index.ts',
);

describe('Subagent TDZ regression (#spawnResult)', () => {
  const source = readFileSync(SUBAGENT_INDEX, 'utf8');

  test('spawnResult is declared with let, not const', () => {
    expect(source).toContain('let spawnResult');
    expect(source).not.toMatch(/const spawnResult\s*=\s*await spawnPiAgent/);
  });

  test('onMessage callback guards against uninitialized spawnResult', () => {
    // The onMessage callback should check `if (!spawnResult)` before accessing it
    const onMessageMatch = source.match(
      /onMessage:\s*\(msg\)\s*=>\s*\{([\s\S]*?)\},\n\s*onToolResult/,
    );
    expect(onMessageMatch).not.toBeNull();
    const onMessageBody = onMessageMatch![1];
    expect(onMessageBody).toContain('if (!spawnResult)');
  });

  test('onToolResult callback guards against uninitialized spawnResult', () => {
    // The onToolResult callback should check `if (!spawnResult)` before accessing it
    const onToolResultMatch = source.match(
      /onToolResult:\s*\(msg\)\s*=>\s*\{([\s\S]*?)\},\n\s*\}\)/,
    );
    expect(onToolResultMatch).not.toBeNull();
    const onToolResultBody = onToolResultMatch![1];
    expect(onToolResultBody).toContain('if (!spawnResult)');
  });

  test('async callback pattern does not throw when callback fires before await resolves', async () => {
    // Simulates the exact pattern: callbacks that reference a `let` variable
    // fire during the async function, before the variable is assigned.
    type Result = { messages: string[]; done: boolean };

    async function fakeSpawn(opts: {
      onMessage: (msg: string) => void;
      onToolResult: (msg: string) => void;
    }): Promise<Result> {
      // Simulate callbacks firing during execution (before await resolves)
      opts.onMessage('hello');
      opts.onToolResult('tool-result');
      return { messages: ['hello', 'tool-result'], done: true };
    }

    const collected: string[] = [];

    // This mirrors the fixed pattern in runSingleAgent
    let spawnResult: Result | undefined;
    spawnResult = await fakeSpawn({
      onMessage: (msg) => {
        if (!spawnResult) {
          collected.push(msg);
        } else {
          collected.push(...spawnResult.messages);
        }
      },
      onToolResult: (msg) => {
        if (!spawnResult) {
          collected.push(msg);
        } else {
          collected.push(...spawnResult.messages);
        }
      },
    });

    expect(collected).toEqual(['hello', 'tool-result']);
    expect(spawnResult.done).toBe(true);
  });

  test('original const pattern WOULD throw (proving the bug existed)', async () => {
    // Demonstrates the original bug: `const` + accessing before init = TDZ error.
    // The error is thrown inside an async IIFE, so we must await the eval'd promise.
    const promise = eval(`
      (async () => {
        const result = await (async (cb) => { cb(); return 42; })(() => {
          void result; // TDZ access
        });
      })()
    `) as Promise<void>;

    expect(promise).rejects.toThrow('Cannot access');
  });
});

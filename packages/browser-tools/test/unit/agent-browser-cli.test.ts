import { describe, expect, test } from 'bun:test';
import { checkAgentBrowserAvailable } from '../../extensions/browser-tools/backends/agent-browser-cli.js';

describe('checkAgentBrowserAvailable', () => {
  test('probes liveness via `session list`, never `doctor`', async () => {
    const calls: string[][] = [];
    await checkAgentBrowserAvailable(async (args) => {
      calls.push(args);
      return { sessions: [] };
    });
    expect(calls).toEqual([['session', 'list']]);
    expect(calls.flat()).not.toContain('doctor');
  });

  test('resolves when the CLI is present and responsive', async () => {
    await expect(
      checkAgentBrowserAvailable(async () => ({ sessions: [] })),
    ).resolves.toBeUndefined();
  });

  test('preserves the detailed ENOENT/install message when the CLI is missing', async () => {
    await expect(
      checkAgentBrowserAvailable(async () => {
        throw new Error('The `agent-browser` executable was not found in PATH.');
      }),
    ).rejects.toThrow(/not found in PATH/u);
  });

  test('surfaces install guidance on any other probe failure', async () => {
    await expect(
      checkAgentBrowserAvailable(async () => {
        throw new Error('connection refused');
      }),
    ).rejects.toThrow(/CLI is unavailable/u);
  });
});

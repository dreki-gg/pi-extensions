import { describe, expect, test } from 'bun:test';
import { runProcess } from '../../extensions/browser-tools/process/run-process.js';

const node = process.execPath;

describe('runProcess', () => {
  test('resolves with stdout, stderr, and exit code', async () => {
    const result = await runProcess({
      command: node,
      args: ['-e', "process.stdout.write('out'); process.stderr.write('err'); process.exit(3)"],
    });
    expect(result.stdout).toBe('out');
    expect(result.stderr).toBe('err');
    expect(result.exitCode).toBe(3);
  });

  test('rejects with a timeout error when the process never exits', async () => {
    await expect(
      runProcess({
        command: node,
        args: ['-e', 'setTimeout(() => {}, 100000)'],
        timeoutMs: 150,
      }),
    ).rejects.toThrow(/timed out/iu);
  });

  test('rejects when the executable does not exist', async () => {
    await expect(
      runProcess({ command: 'definitely-not-a-real-binary-xyz', args: [] }),
    ).rejects.toThrow();
  });

  // Regression for the Windows hang: agent-browser spawns a persistent browser
  // daemon that inherits the parent's stdout/stderr pipes. The CLI process
  // exits, but the pipes stay open, so a `'close'`-based wait never fires. We
  // must settle on `'exit'` instead.
  test('resolves promptly even when a detached child keeps stdout open', async () => {
    const script = [
      "const { spawn } = require('node:child_process');",
      // Grandchild inherits our stdout/stderr and holds them open for 3s.
      "const c = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 3000)'], ",
      "  { stdio: ['ignore', 'inherit', 'inherit'], detached: true });",
      'c.unref();',
      "process.stdout.write('done');",
      'process.exit(0);',
    ].join('\n');

    const start = Date.now();
    const result = await runProcess({ command: node, args: ['-e', script], timeoutMs: 10000 });
    const elapsed = Date.now() - start;

    expect(result.stdout).toContain('done');
    expect(result.exitCode).toBe(0);
    // Must settle on exit, not wait for the 3s daemon to release the pipe.
    expect(elapsed).toBeLessThan(1500);
  });
});

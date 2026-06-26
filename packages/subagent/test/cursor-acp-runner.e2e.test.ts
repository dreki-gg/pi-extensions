/**
 * End-to-end check against a real `cursor-agent acp` server.
 * Gated behind CURSOR_ACP_E2E=1 (requires cursor-agent installed + `agent login`).
 *
 *   CURSOR_ACP_E2E=1 bun test test/cursor-acp-runner.e2e.test.ts
 */

import { describe, expect, it } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCursorAcpAgent } from '../extensions/subagent/cursor/acp-runner.js';

const E2E = !!process.env.CURSOR_ACP_E2E;
const maybe = E2E ? it : it.skip;

describe('runCursorAcpAgent (e2e)', () => {
  maybe(
    'completes a real Composer 2.5 turn',
    async () => {
      const cwd = await mkdtemp(join(tmpdir(), 'cursor-acp-e2e-'));
      const result = await runCursorAcpAgent({
        cwd,
        agentName: 'e2e',
        task: 'Reply with exactly the word: ok',
        model: 'cursor:composer-2.5',
      });

      const text = result.messages
        .filter((m) => m.role === 'assistant')
        .flatMap((m) => (m as any).content)
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('');

      expect(result.exitCode).toBe(0);
      expect(result.stopReason).toBeDefined();
      expect(text.trim().length).toBeGreaterThan(0);
    },
    120_000,
  );
});

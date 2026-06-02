import { describe, expect, test } from 'bun:test';
import { Effect } from 'effect';

import { reviewWithLensEffect } from '../extensions/code-reviewer/reviewer';
import type { LensConfig } from '../extensions/code-reviewer/types';
import { fakeExecutor } from './helpers';

const diff = { diff: 'diff --git a b', stat: ' a | 1 +', label: 'staged changes' };

const lens: LensConfig = {
  name: 'Code Quality',
  description: 'desc',
  criteria: 'no dead code',
  tools: ['bun run lint', 'bun run typecheck'],
  severityRules: { blocker: 'b', warning: 'w', note: 'n' },
};

describe('reviewWithLensEffect', () => {
  test('captures tool output and embeds the diff + criteria in the prompt', async () => {
    const { layer } = fakeExecutor((_cmd, args) => {
      const script = args[args.length - 1];
      if (script === 'bun run lint') return { stdout: 'lint clean', stderr: '' };
      return { fail: new Error('typecheck blew up') };
    });

    const result = await Effect.runPromise(
      reviewWithLensEffect('/repo', lens, '# lens body', diff, undefined).pipe(
        Effect.provide(layer),
      ),
    );

    expect(result.lens).toBe('Code Quality');
    expect(result.toolOutputs?.['bun run lint']).toBe('lint clean');
    // Failed tools degrade gracefully instead of failing the whole review.
    expect(result.toolOutputs?.['bun run typecheck']).toBe(
      '(tool failed or timed out: bun run typecheck)',
    );
    expect(result._prompt).toContain('diff --git a b');
    expect(result._prompt).toContain('# lens body');
    expect(result._lensSection).toContain('Code Quality');
  });

  test('respects an already-aborted signal by running no tools', async () => {
    const { layer, calls } = fakeExecutor(() => ({ stdout: 'x', stderr: '' }));
    const controller = new AbortController();
    controller.abort();

    const result = await Effect.runPromise(
      reviewWithLensEffect('/repo', lens, '', diff, controller.signal).pipe(Effect.provide(layer)),
    );

    expect(calls).toHaveLength(0);
    expect(result.toolOutputs).toEqual({});
  });
});

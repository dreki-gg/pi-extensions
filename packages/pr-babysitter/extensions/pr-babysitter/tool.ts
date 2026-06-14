import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { ExecFn, ExecResult } from './cli/runner';
import { fetchSelfLogin, resolveCurrentPr } from './engine/gh';
import { awaitPrResult, formatReport } from './watcher/await';

const DEFAULT_TIMEOUT_S = 1200; // 20 minutes
const DEFAULT_POLL_S = 15;
const NO_CHECKS_GRACE_S = 60;

/**
 * Register the agent-callable `babysit_pr` tool: block until the PR's checks
 * settle (or it merges/closes), polling internally so the agent never has to
 * sleep-and-poll by hand.
 */
export function registerBabysitTool(pi: ExtensionAPI) {
  const exec: ExecFn = (command, args) => pi.exec(command, args) as Promise<ExecResult>;

  pi.registerTool({
    name: 'babysit_pr',
    label: 'Babysit PR',
    description:
      "Pin a PR and block until its CI checks settle (or it merges/closes), polling GitHub internally. Use this instead of manually running `sleep` + `gh pr checks` in a loop — it waits without consuming turns and returns the final check verdict plus any new review/bot comments. Defaults to the current branch's PR.",
    promptSnippet:
      'Wait for a PR\u2019s checks to finish and get the verdict in one call (no manual sleep/poll loop).',
    promptGuidelines: [
      'Use babysit_pr after creating or pushing to a PR to wait for CI — do not write manual `sleep` + `gh pr checks` polling loops, which waste turns and tokens.',
    ],
    parameters: Type.Object({
      pr: Type.Optional(
        Type.Number({ description: "PR number; defaults to the current branch's PR" }),
      ),
      timeoutSeconds: Type.Optional(
        Type.Number({ description: `Max seconds to wait (default ${DEFAULT_TIMEOUT_S})` }),
      ),
      pollSeconds: Type.Optional(
        Type.Number({ description: `Poll interval in seconds (default ${DEFAULT_POLL_S})` }),
      ),
    }),
    async execute(_toolCallId, params, signal, onUpdate) {
      const pr = params.pr ?? (await resolveCurrentPr(exec))?.number;
      if (!pr) {
        return {
          content: [
            {
              type: 'text',
              text: 'No PR found for the current branch. Create a PR first, or pass an explicit `pr` number.',
            },
          ],
          details: { error: 'no_pr' },
          isError: true,
        };
      }

      const selfLogin = await fetchSelfLogin(exec);
      const report = await awaitPrResult({
        exec,
        pr,
        selfLogin,
        intervalMs: (params.pollSeconds ?? DEFAULT_POLL_S) * 1000,
        timeoutMs: (params.timeoutSeconds ?? DEFAULT_TIMEOUT_S) * 1000,
        noChecksGraceMs: NO_CHECKS_GRACE_S * 1000,
        signal,
        onUpdate: (status) => onUpdate?.({ content: [{ type: 'text', text: status }], details: {} }),
      });

      return {
        content: [{ type: 'text', text: formatReport(report) }],
        details: report,
      };
    },
  });
}

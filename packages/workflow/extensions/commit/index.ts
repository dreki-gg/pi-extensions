import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function (pi: ExtensionAPI) {
  pi.registerCommand('commit', {
    description:
      'Ask the agent to inspect git changes, decide what belongs in the commit, and commit with a generated Conventional Commits message.',
    handler: async (args, ctx) => {
      await ctx.waitForIdle();

      const constraints = args.trim();
      const prompt = buildCommitPrompt(constraints);

      if (ctx.isIdle()) {
        pi.sendUserMessage(prompt);
        return;
      }

      pi.sendUserMessage(prompt, { deliverAs: 'followUp' });
    },
  });
}

function buildCommitPrompt(constraints: string): string {
  return `Execute /commit.

Goal:
- Inspect the current git worktree.
- Decide what should be committed.
- Generate the commit message yourself in Conventional Commits format.
- Create the commit.

Rules:
1. Run git status and inspect relevant diffs before staging anything.
2. Decide the commit set from the actual codebase changes.
3. Stage only files that belong in the selected coherent commit.
4. Do not stage secrets, local config, logs, caches, or unrelated files.
5. If changes are unrelated, create separate conventional commits or commit the main coherent set and report what remains.
6. Use a Conventional Commits subject: type(optional-scope): imperative summary.
7. Keep the first line <= 72 chars.
8. Prefer these types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
9. After committing, show the commit hash and message.

User constraints:
${constraints || '- None.'}`;
}

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGhClient } from './github/client';
import { parseDiff } from './github/parser';
import { generateCanvas } from './canvas/generator';
import { generateHeuristicMindMap } from './ai/mind-map';
import { generateHeuristicSummary } from './ai/summary';

export function registerPrCanvasCommand(pi: ExtensionAPI) {
  pi.registerCommand('pr-canvas', {
    description:
      'Generate a visual canvas for a GitHub Pull Request. Usage: /pr-canvas <number|url>',
    handler: async (args, ctx) => {
      const prRef = parseArgs(args);
      if (!prRef) {
        ctx.ui.notify('Usage: /pr-canvas <number|url>', 'warning');
        return;
      }

      // Check gh CLI is available and authenticated
      ctx.ui.setStatus('pr-canvas', '🔍 Checking gh CLI...');
      try {
        const authResult = await pi.exec('gh', ['auth', 'status']);
        if (authResult.code !== 0) {
          ctx.ui.notify(
            `gh CLI not authenticated: ${authResult.stderr}\nRun \`gh auth login\` first.`,
            'error',
          );
          ctx.ui.setStatus('pr-canvas', undefined);
          return;
        }
      } catch {
        ctx.ui.notify(
          'gh CLI not found. Install it from https://cli.github.com/ and run `gh auth login`.',
          'error',
        );
        ctx.ui.setStatus('pr-canvas', undefined);
        return;
      }

      // Fetch all PR data in parallel
      ctx.ui.setStatus('pr-canvas', '📥 Fetching PR data...');
      const client = createGhClient(pi.exec.bind(pi));

      let overview, rawDiff, checks, commentsData;
      try {
        [overview, rawDiff, checks, commentsData] = await Promise.all([
          client.fetchOverview(prRef),
          client.fetchDiff(prRef),
          client.fetchChecks(prRef).catch(() => []),
          client.fetchCommentsAndReviews(prRef),
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Failed to fetch PR data: ${msg}`, 'error');
        ctx.ui.setStatus('pr-canvas', undefined);
        return;
      }

      const files = parseDiff(rawDiff);
      const prData = {
        overview,
        files,
        checks,
        comments: commentsData.comments,
        reviews: commentsData.reviews,
      };

      // Generate semantic analysis
      ctx.ui.setStatus('pr-canvas', '🧠 Analyzing changes...');
      const mindMap = generateHeuristicMindMap(prData);
      const aiSummary = generateHeuristicSummary(prData);

      // Generate HTML canvas
      ctx.ui.setStatus('pr-canvas', '🎨 Generating canvas...');
      const html = generateCanvas({ pr: prData, mindMap, aiSummary });

      // Write to temp file and open in browser
      const filePath = join(tmpdir(), `pr-canvas-${overview.number}.html`);
      await writeFile(filePath, html, 'utf-8');

      const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
      await pi.exec(openCmd, [filePath]);

      ctx.ui.setStatus('pr-canvas', undefined);
      ctx.ui.notify(`Canvas opened for PR #${overview.number}: ${filePath}`, 'info');
    },
  });
}

function parseArgs(args: string): string | null {
  const trimmed = args?.trim();
  if (!trimmed) return null;

  // Accept PR number
  if (/^\d+$/.test(trimmed)) return trimmed;

  // Accept full GitHub URL
  if (/github\.com\/.+\/pull\/\d+/.test(trimmed)) return trimmed;

  return null;
}

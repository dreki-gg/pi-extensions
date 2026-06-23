import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { type JiraProjectConfig, DEFAULT_CONFIG, loadProjectConfig, qualifyKey } from './config.js';
import {
  AcliError,
  buildCommentCreateArgs,
  buildCommentListArgs,
  buildSearchArgs,
  buildViewArgs,
  checkAuth,
  parseJsonOutput,
  runAcli,
} from './acli.js';
import {
  type JiraComment,
  type JiraIssue,
  extractIssues,
  formatCommentsDigest,
  formatCommentsFull,
  formatSearchDigest,
  formatSearchFull,
  formatWorkItemDigest,
  formatWorkItemFull,
} from './format.js';
import { writeContextFile } from './output.js';

const TOOL_GUIDELINES = [
  'Use `jira_view` to pull a Jira ticket into context before working on it. Pass the key (e.g. "PROJ-123"); a bare number works when a defaultProject is set in .pi/jira.json.',
  'The inline `jira_view` output is a compact digest. The full ticket — complete description and every comment — is written to a temp file whose path is in the response. To read the whole thing, use the `read` tool on that file instead of re-fetching.',
  'Use `jira_search` with JQL to find tickets (e.g. "project = PROJ AND status = \'In Progress\'", "assignee = currentUser()"). It returns a compact list and writes the full results (with descriptions) to a temp file whose path is in the response.',
  "Use `jira_comments` to read a ticket's comment thread. The inline output is a digest of the most recent comments; the complete thread is written to a temp file. Comment bodies and ticket fields can be truncated inline, so when you need the full text, `read` the temp file path rather than re-fetching.",
  'Use `jira_comment` to post a comment. Keep comments concise and factual — a short status update or finding, not a wall of text. Unless the user explicitly asked you to post, confirm the exact wording with them first; comments are visible to the whole team and cannot be unsent cleanly.',
  'All tools require an authenticated Atlassian CLI session. If a tool reports it is not authenticated, tell the user to run `acli jira auth login` in their terminal.',
];

export default function jiraExtension(pi: ExtensionAPI) {
  let config: JiraProjectConfig = { ...DEFAULT_CONFIG };

  async function ensureConfig(cwd?: string): Promise<JiraProjectConfig> {
    if (cwd) {
      try {
        config = await loadProjectConfig(cwd);
      } catch {
        /* keep last-known / defaults */
      }
    }
    return config;
  }

  function acliFailure(err: unknown) {
    if (err instanceof AcliError) {
      return {
        content: [{ type: 'text' as const, text: `❌ ${err.message}` }],
        details: { error: err.code, exitCode: err.exitCode } as Record<string, unknown>,
        isError: true,
      };
    }
    return {
      content: [{ type: 'text' as const, text: `❌ ${(err as Error).message}` }],
      details: { error: 'unknown' } as Record<string, unknown>,
      isError: true,
    };
  }

  pi.on('session_start', async (_event, ctx) => {
    config = await loadProjectConfig(ctx.cwd).catch(() => ({ ...DEFAULT_CONFIG }));
    const auth = await checkAuth(config.acliPath);
    if (!auth.authenticated) {
      ctx.ui.notify(
        `Jira: no authenticated Atlassian CLI session. Run \`acli jira auth login\` to enable Jira tools. (${auth.message})`,
        'warning',
      );
    }
  });

  // -------------------------------------------------------------------------
  // jira_view
  // -------------------------------------------------------------------------
  pi.registerTool({
    name: 'jira_view',
    label: 'Jira View Ticket',
    description:
      'Fetch a Jira work item (description + comments) for context via the Atlassian CLI. Returns a compact digest inline and writes the full ticket to a temp file.',
    promptSnippet: 'Pull a Jira ticket into context (description + comments)',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: Type.Object({
      key: Type.String({
        description:
          'Work item key (e.g. "PROJ-123"). A bare number works if defaultProject is set.',
      }),
      fields: Type.Optional(
        Type.String({
          description:
            'Comma-separated acli field set to override the configured default (e.g. "summary,status,comment", "*all").',
        }),
      ),
    }),
    async execute(
      _id: string,
      params: { key: string; fields?: string },
      signal?: AbortSignal,
      _onUpdate?: unknown,
      ctx?: { cwd: string },
    ) {
      const cfg = await ensureConfig(ctx?.cwd);
      const key = qualifyKey(params.key, cfg.defaultProject);
      try {
        const { stdout } = await runAcli(
          cfg.acliPath,
          buildViewArgs(key, params.fields ?? cfg.viewFields),
          signal,
        );
        const issue = parseJsonOutput<JiraIssue>(stdout);
        const full = formatWorkItemFull(issue);
        let file: string | undefined;
        try {
          file = await writeContextFile(full, key.toLowerCase());
        } catch {
          file = undefined;
        }
        return {
          content: [{ type: 'text' as const, text: formatWorkItemDigest(issue, file) }],
          details: { key, contextFile: file } as Record<string, unknown>,
        };
      } catch (err) {
        return acliFailure(err);
      }
    },
  });

  // -------------------------------------------------------------------------
  // jira_search
  // -------------------------------------------------------------------------
  pi.registerTool({
    name: 'jira_search',
    label: 'Jira Search',
    description:
      'Search Jira work items with JQL via the Atlassian CLI. Returns a compact list of matching keys, statuses, and summaries.',
    promptSnippet: 'Search Jira work items with JQL',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: Type.Object({
      jql: Type.String({
        description:
          'JQL query (e.g. "project = PROJ AND status = \'In Progress\'", "assignee = currentUser() ORDER BY updated DESC").',
      }),
      limit: Type.Optional(
        Type.Number({
          description: 'Max results (1-100). Defaults to searchLimit from .pi/jira.json or 25.',
          minimum: 1,
          maximum: 100,
        }),
      ),
    }),
    async execute(
      _id: string,
      params: { jql: string; limit?: number },
      signal?: AbortSignal,
      _onUpdate?: unknown,
      ctx?: { cwd: string },
    ) {
      const cfg = await ensureConfig(ctx?.cwd);
      try {
        const { stdout } = await runAcli(
          cfg.acliPath,
          buildSearchArgs({ jql: params.jql, limit: params.limit ?? cfg.searchLimit }),
          signal,
        );
        const issues = extractIssues(parseJsonOutput(stdout));
        let file: string | undefined;
        if (issues.length > 0) {
          try {
            file = await writeContextFile(formatSearchFull(issues), 'search');
          } catch {
            file = undefined;
          }
        }
        return {
          content: [{ type: 'text' as const, text: formatSearchDigest(issues, file) }],
          details: {
            count: issues.length,
            keys: issues.map((i) => i.key).filter(Boolean),
            contextFile: file,
          } as Record<string, unknown>,
        };
      } catch (err) {
        return acliFailure(err);
      }
    },
  });

  // -------------------------------------------------------------------------
  // jira_comments
  // -------------------------------------------------------------------------
  pi.registerTool({
    name: 'jira_comments',
    label: 'Jira List Comments',
    description: 'List the comment thread on a Jira work item via the Atlassian CLI.',
    promptSnippet: 'Read the comment thread on a Jira ticket',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: Type.Object({
      key: Type.String({ description: 'Work item key (e.g. "PROJ-123").' }),
      limit: Type.Optional(
        Type.Number({
          description: 'Max comments to return (1-100). Default 50.',
          minimum: 1,
          maximum: 100,
        }),
      ),
    }),
    async execute(
      _id: string,
      params: { key: string; limit?: number },
      signal?: AbortSignal,
      _onUpdate?: unknown,
      ctx?: { cwd: string },
    ) {
      const cfg = await ensureConfig(ctx?.cwd);
      const key = qualifyKey(params.key, cfg.defaultProject);
      try {
        const { stdout } = await runAcli(
          cfg.acliPath,
          buildCommentListArgs(key, params.limit ?? 50),
          signal,
        );
        const payload = parseJsonOutput<{ comments?: JiraComment[] } | JiraComment[]>(stdout);
        const comments = Array.isArray(payload) ? payload : (payload.comments ?? []);
        let file: string | undefined;
        if (comments.length > 0) {
          try {
            file = await writeContextFile(
              formatCommentsFull(comments, key),
              `${key.toLowerCase()}-comments`,
            );
          } catch {
            file = undefined;
          }
        }
        return {
          content: [{ type: 'text' as const, text: formatCommentsDigest(comments, key, file) }],
          details: { key, count: comments.length, contextFile: file } as Record<string, unknown>,
        };
      } catch (err) {
        return acliFailure(err);
      }
    },
  });

  // -------------------------------------------------------------------------
  // jira_comment (write)
  // -------------------------------------------------------------------------
  pi.registerTool({
    name: 'jira_comment',
    label: 'Jira Add Comment',
    description:
      'Post a comment to a Jira work item via the Atlassian CLI. Keep comments concise and factual. Visible to the whole team.',
    promptSnippet: 'Post a concise comment to a Jira ticket',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: Type.Object({
      key: Type.String({ description: 'Work item key (e.g. "PROJ-123").' }),
      body: Type.String({
        description: 'Comment text (plain text). Keep it short and to the point.',
      }),
    }),
    async execute(
      _id: string,
      params: { key: string; body: string },
      signal?: AbortSignal,
      _onUpdate?: unknown,
      ctx?: { cwd: string },
    ) {
      const cfg = await ensureConfig(ctx?.cwd);
      const key = qualifyKey(params.key, cfg.defaultProject);
      if (!params.body.trim()) {
        return {
          content: [{ type: 'text' as const, text: '❌ Comment body is empty.' }],
          details: { error: 'empty_body' } as Record<string, unknown>,
          isError: true,
        };
      }
      try {
        await runAcli(cfg.acliPath, buildCommentCreateArgs(key, params.body), signal);
        return {
          content: [{ type: 'text' as const, text: `✅ Comment added to ${key}.` }],
          details: { key } as Record<string, unknown>,
        };
      } catch (err) {
        return acliFailure(err);
      }
    },
  });

  // -------------------------------------------------------------------------
  // /jira status command
  // -------------------------------------------------------------------------
  pi.registerCommand('jira', {
    description: 'Show Jira (Atlassian CLI) configuration and auth status',
    handler: async (
      _args: string,
      ctx: {
        cwd: string;
        hasUI: boolean;
        ui: { notify(message: string, level: 'info' | 'warning' | 'error'): void };
      },
    ) => {
      const cfg = await ensureConfig(ctx.cwd);
      const auth = await checkAuth(cfg.acliPath);
      const lines = [
        'Jira Extension Status',
        '',
        `Auth: ${auth.authenticated ? '✅ Authenticated' : '❌ Not authenticated'}`,
        `  ${auth.message.split('\n')[0]}`,
        '',
        'Config (.pi/jira.json):',
        `  acli path: ${cfg.acliPath}`,
        `  Default project: ${cfg.defaultProject ?? '(not set)'}`,
        `  View fields: ${cfg.viewFields}`,
        `  Search limit: ${cfg.searchLimit}`,
      ];
      if (!auth.authenticated) {
        lines.push('', 'Run `acli jira auth login` in your terminal to authenticate.');
      }
      if (ctx.hasUI) ctx.ui.notify(lines.join('\n'), 'info');
    },
  });
}

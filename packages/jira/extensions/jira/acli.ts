import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Argument builders (pure — unit tested without spawning acli)
// ---------------------------------------------------------------------------

export function buildAuthStatusArgs(): string[] {
  return ['jira', 'auth', 'status'];
}

export function buildViewArgs(key: string, fields: string): string[] {
  return ['jira', 'workitem', 'view', key, '--fields', fields, '--json'];
}

export interface SearchInput {
  jql: string;
  limit: number;
  fields?: string;
}

export function buildSearchArgs(input: SearchInput): string[] {
  const args = ['jira', 'workitem', 'search', '--jql', input.jql, '--limit', String(input.limit)];
  if (input.fields) {
    args.push('--fields', input.fields);
  }
  args.push('--json');
  return args;
}

export function buildCommentListArgs(key: string, limit: number): string[] {
  return ['jira', 'workitem', 'comment', 'list', '--key', key, '--limit', String(limit), '--json'];
}

export function buildCommentCreateArgs(key: string, body: string): string[] {
  return ['jira', 'workitem', 'comment', 'create', '--key', key, '--body', body, '--json'];
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export interface AcliResult {
  stdout: string;
  stderr: string;
}

export class AcliError extends Error {
  readonly code: 'binary_not_found' | 'not_authenticated' | 'command_failed';
  readonly stderr: string;
  readonly exitCode?: number;

  constructor(
    code: AcliError['code'],
    message: string,
    options: { stderr?: string; exitCode?: number } = {},
  ) {
    super(message);
    this.name = 'AcliError';
    this.code = code;
    this.stderr = options.stderr ?? '';
    this.exitCode = options.exitCode;
  }
}

/** Recognises the auth-failure signature in acli stderr output. */
export function looksUnauthenticated(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('not authenticated') ||
    t.includes('please authenticate') ||
    t.includes('no active session') ||
    t.includes('auth login') ||
    t.includes('unauthorized') ||
    t.includes('401')
  );
}

/**
 * Runs the acli binary and returns stdout/stderr. Maps the common failure
 * modes (missing binary, auth expiry) onto a typed {@link AcliError}.
 */
export async function runAcli(
  bin: string,
  args: string[],
  signal?: AbortSignal,
): Promise<AcliResult> {
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      signal,
      maxBuffer: 32 * 1024 * 1024,
      encoding: 'utf-8',
    });
    return { stdout, stderr };
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: unknown };

    if (e.code === 'ENOENT') {
      throw new AcliError(
        'binary_not_found',
        `Atlassian CLI not found (tried "${bin}"). Install acli and ensure it is on PATH, or set "acliPath" in .pi/jira.json.`,
      );
    }

    const stderr = e.stderr ?? '';
    const stdout = e.stdout ?? '';
    const combined = `${stderr}\n${stdout}`;

    if (looksUnauthenticated(combined)) {
      throw new AcliError(
        'not_authenticated',
        'No authenticated Atlassian CLI session. Run `acli jira auth login` in your terminal, then retry.',
        { stderr },
      );
    }

    const exitCode = typeof e.code === 'number' ? e.code : undefined;
    const detail = (stderr.trim() || stdout.trim() || e.message || 'unknown error').slice(0, 2000);
    throw new AcliError('command_failed', `acli command failed: ${detail}`, { stderr, exitCode });
  }
}

/**
 * Verifies an authenticated acli session via `acli jira auth status`.
 * Returns a flat status object rather than throwing, so the extension can
 * surface a friendly warning without aborting startup.
 */
export async function checkAuth(
  bin: string,
  signal?: AbortSignal,
): Promise<{ authenticated: boolean; message: string }> {
  try {
    const { stdout, stderr } = await runAcli(bin, buildAuthStatusArgs(), signal);
    const text = `${stdout}\n${stderr}`.trim();
    if (looksUnauthenticated(text)) {
      return { authenticated: false, message: text || 'No active session.' };
    }
    return { authenticated: true, message: text || 'Authenticated.' };
  } catch (err) {
    if (err instanceof AcliError) {
      return { authenticated: false, message: err.message };
    }
    return { authenticated: false, message: (err as Error).message };
  }
}

/** Parses acli `--json` stdout, tolerating leading/trailing non-JSON noise. */
export function parseJsonOutput<T = unknown>(stdout: string): T {
  const trimmed = stdout.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // acli occasionally prefixes a status line before the JSON payload.
    const start = trimmed.search(/[[{]/);
    if (start > 0) {
      try {
        return JSON.parse(trimmed.slice(start)) as T;
      } catch {
        /* fall through */
      }
    }
    throw new AcliError('command_failed', 'Could not parse acli JSON output.');
  }
}

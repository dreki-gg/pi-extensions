/**
 * GitHub reads via the `gh` CLI, over an injected `ExecFn`.
 *
 * Observe-only: every call here is a read. Pure JSON parsing is split from the
 * IO wrappers so the parsers are trivially unit-testable with fixture strings.
 */
import type { ExecFn } from '../cli/runner';

export interface PrRef {
  number: number;
  headRefName: string;
  state: string;
  url: string;
}

export interface CheckRun {
  name: string;
  /** gh check bucket: pass | fail | pending | skipping | cancel. */
  bucket: string;
  link?: string;
}

export type CommentKind = 'issue' | 'review' | 'inline';

export interface PrComment {
  /** Namespaced stable id, e.g. "review:PRR_kw...", "inline:123". */
  id: string;
  author: string;
  body: string;
  kind: CommentKind;
}

// ---------------------------------------------------------------------------
// Pure parsers
// ---------------------------------------------------------------------------

function safeParse(stdout: string): unknown {
  try {
    return JSON.parse(stdout);
  } catch {
    return undefined;
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function authorLogin(value: unknown): string {
  if (value && typeof value === 'object') {
    const login = (value as { login?: unknown }).login;
    if (typeof login === 'string') return login;
  }
  return 'unknown';
}

/** Parse `gh pr view --json number,headRefName,state,url`. */
export function parseCurrentPr(stdout: string): PrRef | null {
  const parsed = safeParse(stdout);
  if (!parsed || typeof parsed !== 'object') return null;
  const raw = parsed as Record<string, unknown>;
  if (typeof raw.number !== 'number') return null;
  return {
    number: raw.number,
    headRefName: asString(raw.headRefName) ?? '',
    state: asString(raw.state) ?? 'OPEN',
    url: asString(raw.url) ?? '',
  };
}

/** Parse `gh pr checks <n> --json name,state,bucket,link`. Tolerant of junk. */
export function parseChecks(stdout: string): CheckRun[] {
  const parsed = safeParse(stdout);
  if (!Array.isArray(parsed)) return [];
  const checks: CheckRun[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const raw = entry as Record<string, unknown>;
    const name = asString(raw.name);
    const bucket = asString(raw.bucket) ?? asString(raw.state);
    if (!name || !bucket) continue;
    checks.push({ name, bucket: bucket.toLowerCase(), link: asString(raw.link) });
  }
  return checks;
}

/**
 * Parse `gh pr view --json comments,reviews` into normalized comments.
 * Reviews with an empty body are dropped (their inline notes are covered by
 * {@link parseInlineComments}).
 */
export function parsePrViewComments(stdout: string): PrComment[] {
  const parsed = safeParse(stdout);
  if (!parsed || typeof parsed !== 'object') return [];
  const raw = parsed as { comments?: unknown; reviews?: unknown };
  const out: PrComment[] = [];

  if (Array.isArray(raw.comments)) {
    for (const c of raw.comments) {
      if (!c || typeof c !== 'object') continue;
      const r = c as Record<string, unknown>;
      const id = asString(r.id);
      const body = asString(r.body) ?? '';
      if (!id || body.trim() === '') continue;
      out.push({ id: `issue:${id}`, author: authorLogin(r.author), body, kind: 'issue' });
    }
  }

  if (Array.isArray(raw.reviews)) {
    for (const v of raw.reviews) {
      if (!v || typeof v !== 'object') continue;
      const r = v as Record<string, unknown>;
      const id = asString(r.id);
      const body = asString(r.body) ?? '';
      if (!id || body.trim() === '') continue;
      out.push({ id: `review:${id}`, author: authorLogin(r.author), body, kind: 'review' });
    }
  }

  return out;
}

/** Parse `gh api repos/{owner}/{repo}/pulls/<n>/comments` (inline review threads). */
export function parseInlineComments(stdout: string): PrComment[] {
  const parsed = safeParse(stdout);
  if (!Array.isArray(parsed)) return [];
  const out: PrComment[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const r = entry as Record<string, unknown>;
    const id = r.id;
    const body = asString(r.body) ?? '';
    if ((typeof id !== 'number' && typeof id !== 'string') || body.trim() === '') continue;
    out.push({ id: `inline:${id}`, author: authorLogin(r.user), body, kind: 'inline' });
  }
  return out;
}

/** Parse `gh pr view --json state` -> PR state (OPEN | MERGED | CLOSED). */
export function parsePrState(stdout: string): string | null {
  const parsed = safeParse(stdout);
  if (!parsed || typeof parsed !== 'object') return null;
  return asString((parsed as Record<string, unknown>).state) ?? null;
}

/** Parse `gh api user` -> login. */
export function parseSelfLogin(stdout: string): string | undefined {
  const parsed = safeParse(stdout);
  if (!parsed || typeof parsed !== 'object') return undefined;
  return asString((parsed as Record<string, unknown>).login);
}

// ---------------------------------------------------------------------------
// IO wrappers (thin shell over ExecFn)
// ---------------------------------------------------------------------------

/** Resolve the open PR for the current branch, or null when there is none. */
export async function resolveCurrentPr(exec: ExecFn): Promise<PrRef | null> {
  const res = await exec('gh', ['pr', 'view', '--json', 'number,headRefName,state,url']);
  if (res.code !== 0) return null;
  return parseCurrentPr(res.stdout);
}

/** Fetch check runs for a PR. Parses stdout regardless of exit code (gh exits
 * non-zero while checks are pending/failing but still emits JSON). */
export async function fetchChecks(exec: ExecFn, pr: number): Promise<CheckRun[]> {
  const res = await exec('gh', [
    'pr',
    'checks',
    String(pr),
    '--json',
    'name,state,bucket,link',
  ]);
  return parseChecks(res.stdout);
}

/** Fetch issue comments, review submissions, and inline review-thread comments. */
export async function fetchComments(exec: ExecFn, pr: number): Promise<PrComment[]> {
  const view = await exec('gh', ['pr', 'view', String(pr), '--json', 'comments,reviews']);
  const inline = await exec('gh', [
    'api',
    `repos/{owner}/{repo}/pulls/${pr}/comments`,
  ]);
  return [
    ...parsePrViewComments(view.code === 0 ? view.stdout : ''),
    ...parseInlineComments(inline.code === 0 ? inline.stdout : ''),
  ];
}

/** Current lifecycle state of a PR (OPEN | MERGED | CLOSED), or null on error. */
export async function fetchPrState(exec: ExecFn, pr: number): Promise<string | null> {
  const res = await exec('gh', ['pr', 'view', String(pr), '--json', 'state']);
  if (res.code !== 0) return null;
  return parsePrState(res.stdout);
}

/** The authenticated gh user's login (used to skip the human's own comments). */
export async function fetchSelfLogin(exec: ExecFn): Promise<string | undefined> {
  const res = await exec('gh', ['api', 'user']);
  if (res.code !== 0) return undefined;
  return parseSelfLogin(res.stdout);
}

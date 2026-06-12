/**
 * GitHub interaction via the `gh` CLI, over an injected exec function.
 * Pure JSON parsing is split out for testability.
 */
import type { ExecFn } from '../cli/runner';

export type PrState = 'OPEN' | 'CLOSED' | 'MERGED';

export interface PrInfo {
  number: number;
  headRefName: string;
  baseRefName: string;
  title: string;
  state?: PrState;
  body?: string;
  /** Squash/merge commit SHA when merged. */
  mergeCommit?: string;
}

interface RawPr {
  number?: number;
  headRefName?: string;
  baseRefName?: string;
  title?: string;
  state?: string;
  body?: string;
  mergeCommit?: { oid?: string } | null;
}

/** Parse `gh pr list --json ...` output into typed PrInfo[]. Tolerant of junk. */
export function parseGhPrList(stdout: string): PrInfo[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map(toPrInfo).filter((p): p is PrInfo => p !== null);
}

/** Parse a single `gh pr view --json ...` object. */
export function parseGhPrView(stdout: string): PrInfo | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return null;
  }
  return toPrInfo(parsed);
}

function toPrInfo(value: unknown): PrInfo | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as RawPr;
  if (
    typeof raw.number !== 'number' ||
    typeof raw.headRefName !== 'string' ||
    typeof raw.baseRefName !== 'string'
  ) {
    return null;
  }
  const info: PrInfo = {
    number: raw.number,
    headRefName: raw.headRefName,
    baseRefName: raw.baseRefName,
    title: typeof raw.title === 'string' ? raw.title : '',
  };
  if (typeof raw.state === 'string') info.state = raw.state.toUpperCase() as PrState;
  if (typeof raw.body === 'string') info.body = raw.body;
  if (raw.mergeCommit && typeof raw.mergeCommit.oid === 'string') {
    info.mergeCommit = raw.mergeCommit.oid;
  }
  return info;
}

const LIST_FIELDS = 'number,headRefName,baseRefName,title';
const VIEW_FIELDS = 'number,headRefName,baseRefName,title,state,body,mergeCommit';

/** List open PRs authored in this repo. */
export async function listOpenPrs(exec: ExecFn): Promise<PrInfo[]> {
  const res = await exec('gh', [
    'pr',
    'list',
    '--state',
    'open',
    '--json',
    LIST_FIELDS,
    '--limit',
    '100',
  ]);
  if (res.code !== 0) return [];
  return parseGhPrList(res.stdout);
}

/** View a single PR with full detail (state, body, mergeCommit). */
export async function viewPr(exec: ExecFn, number: number): Promise<PrInfo | null> {
  const res = await exec('gh', ['pr', 'view', String(number), '--json', VIEW_FIELDS]);
  if (res.code !== 0) return null;
  return parseGhPrView(res.stdout);
}

/** Retarget a PR's base branch. */
export async function setPrBase(exec: ExecFn, number: number, base: string): Promise<boolean> {
  const res = await exec('gh', ['pr', 'edit', String(number), '--base', base]);
  return res.code === 0;
}

/** Replace a PR body. */
export async function setPrBody(exec: ExecFn, number: number, body: string): Promise<boolean> {
  const res = await exec('gh', ['pr', 'edit', String(number), '--body', body]);
  return res.code === 0;
}

/** Create a PR for a branch against a base. Returns the new number, if parseable. */
export async function createPr(
  exec: ExecFn,
  opts: { head: string; base: string; title: string; body?: string },
): Promise<number | null> {
  const args = [
    'pr',
    'create',
    '--head',
    opts.head,
    '--base',
    opts.base,
    '--title',
    opts.title,
    '--body',
    opts.body ?? '',
  ];
  const res = await exec('gh', args);
  if (res.code !== 0) return null;
  // gh prints the PR URL; extract the trailing number.
  const match = res.stdout.trim().match(/\/(\d+)\s*$/);
  return match ? Number.parseInt(match[1]!, 10) : null;
}

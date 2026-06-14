/**
 * Recorded-rejection store: persist validator false-positives and, on later
 * runs, downrank+tag findings that match a past rejection (never hide them).
 *
 * Failure-tolerant by design — any FS or parse error degrades to "no
 * rejections" so a review is never broken by a missing/garbled store. Node-only
 * (node:fs/promises), never Bun, since extension source runs on Node via jiti.
 */

import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { sameBug, tokenize } from './similarity';
import type { CandidateFinding, RejectionRecord, ValidatedFinding } from './types';

/** Keep the store bounded; oldest records are dropped past this many. */
export const DEFAULT_REJECTION_CAP = 200;

/** Read the JSONL store, tolerating a missing file or garbled lines. */
export async function loadRejections(path: string): Promise<RejectionRecord[]> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return [];
  }
  const records: RejectionRecord[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (
        typeof parsed.file === 'string' &&
        typeof parsed.message === 'string' &&
        typeof parsed.severity === 'string'
      ) {
        records.push(parsed as unknown as RejectionRecord);
      }
    } catch {
      // Skip an unparseable line rather than discard the whole store.
    }
  }
  return records;
}

/** Does a finding match any recorded rejection (same file + co-located/similar)? */
export function matchesRejection(
  finding: { file: string; line?: number; message: string },
  rejections: RejectionRecord[],
): boolean {
  const tokens = tokenize(finding.message);
  return rejections.some((record) =>
    sameBug(
      { file: finding.file, line: finding.line, tokens },
      { file: record.file, line: record.line, tokens: tokenize(record.message) },
    ),
  );
}

/** Tag findings matching a past rejection and downrank them to the bottom,
 *  preserving the existing leverage order within each group. Pure. */
export function applyRejections(
  findings: ValidatedFinding[],
  rejections: RejectionRecord[],
): ValidatedFinding[] {
  if (rejections.length === 0) return findings;
  const tagged = findings.map((finding) =>
    matchesRejection(finding, rejections) ? { ...finding, previouslyRejected: true } : finding,
  );
  const kept = tagged.filter((finding) => !finding.previouslyRejected);
  const downranked = tagged.filter((finding) => finding.previouslyRejected);
  return [...kept, ...downranked];
}

/** Convert this run's validator-refuted candidates into rejection records. */
export function toRejectionRecords(
  rejected: CandidateFinding[],
  now: string = new Date().toISOString(),
): RejectionRecord[] {
  return rejected.map((candidate) => ({
    file: candidate.file,
    line: candidate.line,
    severity: candidate.severity,
    message: candidate.message,
    recorded_at: now,
  }));
}

/** Append new rejections, deduping against existing ones and capping the total.
 *  Never throws — a write failure silently no-ops. */
export async function appendRejections(
  path: string,
  entries: RejectionRecord[],
  cap: number = DEFAULT_REJECTION_CAP,
): Promise<void> {
  if (entries.length === 0) return;
  try {
    const existing = await loadRejections(path);
    const fresh = entries.filter(
      (entry) => !matchesRejection({ file: entry.file, line: entry.line, message: entry.message }, existing),
    );
    if (fresh.length === 0) return;
    const merged = [...existing, ...fresh].slice(-cap);
    await mkdir(dirname(path), { recursive: true });
    if (merged.length === existing.length + fresh.length) {
      // Nothing was capped out — a plain append keeps the file append-only.
      await appendFile(path, fresh.map((entry) => JSON.stringify(entry)).join('\n') + '\n', 'utf8');
    } else {
      // Cap trimmed older records — rewrite the whole bounded store.
      await writeFile(path, merged.map((entry) => JSON.stringify(entry)).join('\n') + '\n', 'utf8');
    }
  } catch {
    // Persisting rejections must never break a review.
  }
}

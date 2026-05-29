import { mkdir, readFile } from 'node:fs/promises';
import { writeFileAtomic } from './atomic-write.js';

const MANIFEST_PATH = '.plans/plans.jsonl';

export interface PlanManifestEntry {
  _type: 'plan';
  name: string;
  status: 'in-progress' | 'done';
  title: string;
  created_at: string;
  completed_at: string | null;
}

export async function readPlansManifest(): Promise<PlanManifestEntry[]> {
  let text: string;
  try {
    text = await readFile(MANIFEST_PATH, 'utf8');
  } catch {
    return [];
  }
  const entries: PlanManifestEntry[] = [];
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    if (!raw.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Invalid plans.jsonl at line ${index + 1}: ${(error as Error).message}`);
    }
    if (!isPlanManifestEntry(parsed))
      throw new Error(`Invalid plans.jsonl record at line ${index + 1}`);
    entries.push(parsed);
  }
  return entries;
}

export async function writePlansManifest(entries: PlanManifestEntry[]): Promise<void> {
  await mkdir('.plans', { recursive: true });
  const content =
    entries.map((entry) => JSON.stringify(entry)).join('\n') + (entries.length ? '\n' : '');
  await writeFileAtomic(MANIFEST_PATH, content);
}

export async function upsertPlanEntry(
  name: string,
  updates: { status: 'in-progress' | 'done'; title?: string },
): Promise<void> {
  const entries = await readPlansManifest();
  const now = new Date().toISOString();
  const index = entries.findIndex((entry) => entry.name === name);
  const existing = index === -1 ? undefined : entries[index];
  const entry: PlanManifestEntry = {
    _type: 'plan',
    name,
    status: updates.status,
    title: updates.title ?? existing?.title ?? 'Untitled plan',
    created_at: existing?.created_at ?? now,
    completed_at: updates.status === 'done' ? now : null,
  };
  if (index === -1) entries.push(entry);
  else entries[index] = entry;
  await writePlansManifest(entries);
}

function isPlanManifestEntry(value: unknown): value is PlanManifestEntry {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record._type === 'plan' &&
    typeof record.name === 'string' &&
    (record.status === 'in-progress' || record.status === 'done') &&
    typeof record.title === 'string' &&
    typeof record.created_at === 'string' &&
    (record.completed_at === null || typeof record.completed_at === 'string')
  );
}

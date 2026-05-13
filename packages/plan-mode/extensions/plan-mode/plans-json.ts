/**
 * Reads and writes `.plans/plans.json` — the tracking manifest for plan lifecycle.
 *
 * Schema:
 * ```json
 * {
 *   "<plan-name>": {
 *     "status": "in-progress" | "done",
 *     "title": "Human-readable plan title",
 *     "created": "2026-05-08T12:00:00.000Z",
 *     "completed": "2026-05-08T13:00:00.000Z" | null
 *   }
 * }
 * ```
 */

export interface PlanEntry {
  status: 'in-progress' | 'done';
  title: string;
  created: string;
  completed: string | null;
}

export type PlansManifest = Record<string, PlanEntry>;

import { readFile } from 'node:fs/promises';

const PLANS_JSON = '.plans/plans.json';

/** Read plans.json, returning current manifest (empty object if missing). */
export async function readPlansJson(): Promise<PlansManifest> {
  try {
    const text = await readFile(PLANS_JSON, 'utf-8');
    if (text.trim()) {
      return JSON.parse(text) as PlansManifest;
    }
  } catch {
    // File doesn't exist or isn't valid JSON
  }
  return {};
}

/** Serialize the manifest to a formatted JSON string. */
export function serializePlansJson(manifest: PlansManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** Extract the plan title from the first `# ...` heading in PLAN.md content. */
export function extractPlanTitle(planContent: string): string {
  const match = planContent.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled plan';
}

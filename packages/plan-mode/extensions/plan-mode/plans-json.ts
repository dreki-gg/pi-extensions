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

const PLANS_JSON = '.plans/plans.json';

/** Read plans.json via pi.exec, returning current manifest (empty object if missing). */
export async function readPlansJson(exec: (cmd: string, args: string[]) => Promise<{ code: number; stdout: string }>): Promise<PlansManifest> {
  try {
    const result = await exec('cat', [PLANS_JSON]);
    if (result.code === 0 && result.stdout.trim()) {
      return JSON.parse(result.stdout) as PlansManifest;
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

/**
 * `@plan:` context injection.
 *
 * When a submitted message references a plan with `@plan:<slug>`, attach that
 * plan's tasks + handoff as a hidden context message so the agent understands
 * the reference. First-wins: only the first token in the message is resolved.
 *
 * This is *context only* — it never switches execution mode, tools, or model.
 */

import { Effect } from 'effect';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { FileSystem } from '@dreki-gg/taskman';
import type { RunPlanIO } from '@dreki-gg/taskman';
import type { PlanStatus, TaskRecord, TaskStatus } from '../types.js';
import { readPlansManifest } from '@dreki-gg/taskman';
import { readTasksJsonl } from '@dreki-gg/taskman';
import { loadHandoff } from '@dreki-gg/taskman';
import { firstPlanReference } from './tokens.js';

export interface ResolvedPlanReference {
  name: string;
  title: string;
  status: PlanStatus;
  tasks: TaskRecord[];
  handoff: string;
}

const TASK_ICON: Record<TaskStatus, string> = {
  pending: '○',
  done: '✓',
  skipped: '⊘',
  blocked: '✗',
  deferred: '⏸',
};

/** Resolve a plan slug to its registry entry + tasks + handoff (Effect-based). */
export function resolvePlanReference(
  slug: string,
): Effect.Effect<ResolvedPlanReference | undefined, never, FileSystem> {
  return Effect.gen(function* () {
    const manifest = yield* Effect.orElseSucceed(readPlansManifest(), () => []);
    const entry = manifest.find((candidate) => candidate.name === slug);
    if (!entry) return undefined;

    const dir = `.plans/${slug}`;
    const snapshot = yield* Effect.orElseSucceed(readTasksJsonl(dir), () => undefined);
    const handoff = yield* loadHandoff(dir);

    return {
      name: entry.name,
      title: entry.title,
      status: entry.status,
      tasks: snapshot?.tasks ?? [],
      handoff: handoff ?? '',
    };
  });
}

/** Build the markdown context pack injected for a resolved plan reference. */
export function buildPlanContextPack(
  name: string,
  title: string,
  status: PlanStatus,
  tasks: TaskRecord[],
  handoff: string,
): string {
  const done = tasks.filter((t) => t.status === 'done' || t.status === 'skipped').length;
  const taskLines = tasks.length
    ? tasks
        .map((t) => {
          const marker = t.origin === 'discovered' ? ' (discovered)' : '';
          const notes = t.notes ? `\n   ${t.notes}` : '';
          return `${t.id}. ${TASK_ICON[t.status]} ${t.description}${marker}${notes}`;
        })
        .join('\n')
    : '_(no tasks)_';

  return [
    `# Referenced plan: ${title} (\`${name}\`)`,
    `The user referenced this plan with \`@plan:${name}\`. Status: **${status}** — ${done}/${tasks.length} tasks done.`,
    `Use this as context. The source of truth is \`.plans/${name}/\` (tasks.jsonl + HANDOFF.md) — inspect it with tools if you need more detail.`,
    '',
    '## Tasks',
    '',
    taskLines,
    '',
    '## Handoff',
    '',
    handoff.trim() || '_(no handoff recorded)_',
  ].join('\n');
}

/**
 * Register the `before_agent_start` handler that attaches a referenced plan as
 * context. Chains alongside plan-mode's own `before_agent_start` handler.
 */
export function registerPlanReferenceContext(pi: ExtensionAPI, runPlanIO: RunPlanIO): void {
  pi.on('before_agent_start', async (event, ctx) => {
    const slug = firstPlanReference(event.prompt);
    if (!slug) return undefined;

    const resolved = await runPlanIO(resolvePlanReference(slug));

    if (!resolved) {
      if (ctx.hasUI) {
        ctx.ui.notify(`plan-mode: no plan named "${slug}" for @plan:${slug}`, 'warning');
      }
      return {
        message: {
          customType: 'plan-reference-context',
          content: `The prompt referenced @plan:${slug}, but no plan with that name exists in .plans/plans.jsonl.`,
          display: true,
          details: { slug, resolved: false },
        },
      };
    }

    const content = buildPlanContextPack(
      resolved.name,
      resolved.title,
      resolved.status,
      resolved.tasks,
      resolved.handoff,
    );

    if (ctx.hasUI) {
      ctx.ui.notify(`Attached plan reference: ${resolved.title} (${resolved.name}).`, 'info');
    }

    return {
      message: {
        customType: 'plan-reference-context',
        content,
        display: false,
        details: { slug, name: resolved.name, status: resolved.status, resolved: true },
      },
    };
  });
}

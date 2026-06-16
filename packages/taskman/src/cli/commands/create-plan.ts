/**
 * `taskman create-plan` — create a plan from a foreign harness.
 *
 * The CLI sibling of plan-mode's `submit_plan` tool: writes tasks.jsonl,
 * HANDOFF.md, and a plans.jsonl registry entry in one transaction, then
 * re-projects the parent initiative (when linked). Handoff/tasks payloads come
 * from inline values, files, or stdin so any harness can drive it.
 */

import { Effect } from 'effect';
import { writeTasksJsonl } from '../../storage/task-storage.js';
import { saveHandoff } from '../../storage/plan-storage.js';
import { upsertPlanEntry } from '../../storage/plans-manifest.js';
import { readInitiativesManifest } from '../../storage/initiatives-manifest.js';
import { reconcileInitiativeForPlan } from '../../initiative.js';
import { nextTaskId, toKebabCase } from '../../ids.js';
import type { TaskMeta, TaskRecord } from '../../types.js';
import { runPlanIO, CliError } from '../runtime.js';
import { resolveContent } from '../input.js';
import { emit } from '../format.js';

interface TaskInput {
  id?: string;
  description: string;
  details?: string;
  depends_on?: string[];
}

/** Parse and validate the `--tasks` JSON payload into TaskInput[]. */
function parseTasks(raw: string): TaskInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CliError('--tasks must be a JSON array of { description, ... } objects.');
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new CliError('--tasks must be a non-empty JSON array.');
  }
  return parsed.map((entry, i) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new CliError(`Task at index ${i} is not an object.`);
    }
    const { description } = entry as Record<string, unknown>;
    if (typeof description !== 'string' || description.trim() === '') {
      throw new CliError(`Task at index ${i} is missing a "description".`);
    }
    const t = entry as TaskInput;
    return { id: t.id, description: t.description, details: t.details, depends_on: t.depends_on };
  });
}

/** Assign explicit IDs where given, generate t-NNN for the rest. */
function assignIds(inputs: TaskInput[], now: string): TaskRecord[] {
  const ids = inputs.map((t) => t.id).filter((id): id is string => Boolean(id));
  const records: TaskRecord[] = [];
  for (const input of inputs) {
    const id = input.id ?? nextTaskId(ids);
    if (!input.id) ids.push(id);
    records.push({
      _type: 'task',
      id,
      description: input.description.slice(0, 60),
      details: input.details ?? '',
      status: 'pending',
      depends_on: input.depends_on,
      created_at: now,
      updated_at: now,
    });
  }
  return records;
}

export async function createPlanCommand(opts: {
  name?: string;
  title?: string;
  handoff?: string;
  handoffFile?: string;
  tasks?: string;
  tasksFile?: string;
  initiative?: string;
  dependsOn?: string;
  json?: boolean;
}): Promise<void> {
  if (!opts.name) throw new CliError('--name is required.');
  if (!opts.title) throw new CliError('--title is required.');

  const planName = toKebabCase(opts.name);
  const planDir = `.plans/${planName}`;
  const initiative = opts.initiative ? toKebabCase(opts.initiative) : undefined;
  const dependsOnPlans = opts.dependsOn
    ? opts.dependsOn
        .split(',')
        .map((s) => toKebabCase(s.trim()))
        .filter(Boolean)
    : undefined;
  const now = new Date().toISOString();

  const handoff = await resolveContent(opts.handoff, opts.handoffFile, 'handoff');
  const tasksRaw = await resolveContent(opts.tasks, opts.tasksFile, 'tasks');
  const tasks = assignIds(parseTasks(tasksRaw), now);

  const meta: TaskMeta = {
    _type: 'meta',
    title: opts.title,
    plan_name: planName,
    created_at: now,
  };

  const unknownInitiative = await runPlanIO(
    Effect.gen(function* () {
      yield* writeTasksJsonl(planDir, meta, tasks);
      yield* saveHandoff(planDir, handoff);
      yield* upsertPlanEntry(planName, {
        status: 'in-progress',
        title: opts.title!,
        initiative,
        depends_on: dependsOnPlans,
      });
      yield* reconcileInitiativeForPlan(planName);
      if (!initiative) return false;
      const initiatives = yield* readInitiativesManifest();
      return !initiatives.some((entry) => entry.name === initiative);
    }),
  );

  const linkSuffix = initiative
    ? ` Linked to initiative "${initiative}"${
        unknownInitiative ? ' (no initiatives.jsonl entry yet — create it with submit_initiative)' : ''
      }.`
    : '';

  emit(
    Boolean(opts.json),
    {
      plan_name: planName,
      plan_dir: planDir,
      task_count: tasks.length,
      task_ids: tasks.map((t) => t.id),
      initiative: initiative ?? null,
      depends_on: dependsOnPlans ?? null,
      unknown_initiative: unknownInitiative,
    },
    `Plan "${opts.title}" saved with ${tasks.length} tasks in ${planDir}.${linkSuffix}`,
  );
}

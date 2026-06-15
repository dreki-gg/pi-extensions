/**
 * High-level task-management operations that compose storage writes with the
 * registry/initiative status projection — the same flow the pi extension runs
 * inline on every task write. Consumers (CLI, automation) should call these
 * rather than re-implementing the write→reconcile sequence.
 */

import { Effect } from 'effect';
import { FileSystem } from './effects/filesystem.js';
import type {
  JsonlParseError,
  JsonlValidationError,
  MissingMetaRecord,
  PlanWriteError,
} from './errors.js';
import { TaskNotFound, TasksFileNotFound } from './errors.js';
import { readTasksJsonl, writeTasksJsonl } from './storage/task-storage.js';
import { reconcilePlanStatus } from './storage/plans-manifest.js';
import { reconcileInitiativeForPlan } from './initiative.js';
import { isPlanFinalizable } from './task-status.js';
import { nextTaskId } from './ids.js';
import type { TaskRecord, TaskStatus } from './types.js';

type ReadError = JsonlParseError | JsonlValidationError | MissingMetaRecord;
type WriteFlowError = ReadError | PlanWriteError | TasksFileNotFound;

/** Re-derive plan + parent-initiative registry status from current task state. */
function reconcileFromTasks(
  planName: string,
  tasks: readonly TaskRecord[],
  title: string,
): Effect.Effect<void, ReadError | PlanWriteError, FileSystem> {
  return Effect.gen(function* () {
    yield* reconcilePlanStatus(planName, isPlanFinalizable(tasks), title);
    yield* reconcileInitiativeForPlan(planName);
  });
}

export interface UpdatedTaskResult {
  task: TaskRecord;
  finalizable: boolean;
}

/**
 * Set a task's status (and optional notes), persist, then re-project registry
 * status. Mirrors the extension's `onTaskUpdated`.
 */
export function setTaskStatus(
  planDir: string,
  taskId: string,
  status: TaskStatus,
  notes?: string,
): Effect.Effect<UpdatedTaskResult, WriteFlowError | TaskNotFound, FileSystem> {
  return Effect.gen(function* () {
    const snapshot = yield* readTasksJsonl(planDir);
    if (!snapshot) return yield* Effect.fail(new TasksFileNotFound({ planDir }));

    const task = snapshot.tasks.find((t) => t.id === taskId);
    if (!task) return yield* Effect.fail(new TaskNotFound({ planDir, taskId }));

    task.status = status;
    task.updated_at = new Date().toISOString();
    if (notes) task.notes = notes;

    yield* writeTasksJsonl(planDir, snapshot.meta, snapshot.tasks);
    yield* reconcileFromTasks(snapshot.meta.plan_name, snapshot.tasks, snapshot.meta.title);
    return { task, finalizable: isPlanFinalizable(snapshot.tasks) };
  });
}

export interface AddTaskInput {
  description: string;
  reason: string;
  details?: string;
  depends_on?: string[];
}

/**
 * Append a discovered follow-up as a `deferred` task, persist, then re-project
 * registry status (a new deferred task can re-open a done plan). Mirrors the
 * extension's `add_task` + `onTaskAdded`.
 */
export function appendDeferredTask(
  planDir: string,
  input: AddTaskInput,
): Effect.Effect<TaskRecord, WriteFlowError, FileSystem> {
  return Effect.gen(function* () {
    const snapshot = yield* readTasksJsonl(planDir);
    if (!snapshot) return yield* Effect.fail(new TasksFileNotFound({ planDir }));

    const now = new Date().toISOString();
    const task: TaskRecord = {
      _type: 'task',
      id: nextTaskId(snapshot.tasks.map((t) => t.id)),
      description: input.description.slice(0, 60),
      details: input.details ?? '',
      status: 'deferred',
      origin: 'discovered',
      depends_on: input.depends_on,
      notes: input.reason,
      created_at: now,
      updated_at: now,
    };
    snapshot.tasks.push(task);

    yield* writeTasksJsonl(planDir, snapshot.meta, snapshot.tasks);
    yield* reconcileFromTasks(snapshot.meta.plan_name, snapshot.tasks, snapshot.meta.title);
    return task;
  });
}

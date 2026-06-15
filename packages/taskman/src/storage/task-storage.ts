import { Effect, Either, Option } from 'effect';
import { join } from 'node:path';
import { FileSystem } from '../effects/filesystem.js';
import {
  JsonlParseError,
  JsonlValidationError,
  MissingMetaRecord,
  PlanWriteError,
  TaskNotFound,
  TasksFileNotFound,
} from '../errors.js';
import { decodeTasksLine } from '../schema.js';
import type { TaskMeta, TaskRecord } from '../types.js';
import { withFileLock } from './file-lock.js';

const TASKS_FILE = 'tasks.jsonl';

export interface TasksSnapshot {
  meta: TaskMeta;
  tasks: TaskRecord[];
}

type ReadError = JsonlParseError | JsonlValidationError | MissingMetaRecord;

export function readTasksJsonl(
  planDir: string,
): Effect.Effect<TasksSnapshot | undefined, ReadError, FileSystem> {
  const path = join(planDir, TASKS_FILE);
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    // A read failure (missing or unreadable file) is treated as "no snapshot".
    const maybeText = yield* Effect.option(fs.readFileString(path));
    if (Option.isNone(maybeText)) return undefined;

    const text = maybeText.value;
    if (!text.trim()) return yield* Effect.fail(new MissingMetaRecord({ path }));

    let meta: TaskMeta | undefined;
    const tasks: TaskRecord[] = [];
    for (const [index, raw] of text.split(/\r?\n/).entries()) {
      if (!raw.trim()) continue;
      const line = index + 1;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (cause) {
        return yield* Effect.fail(new JsonlParseError({ path, line, cause }));
      }

      const decoded = decodeTasksLine(parsed);
      if (Either.isLeft(decoded)) {
        return yield* Effect.fail(
          new JsonlValidationError({ path, line, reason: decoded.left.message }),
        );
      }

      const record = decoded.right;
      if (record._type === 'meta') meta = record;
      else tasks.push(record);
    }

    if (!meta) return yield* Effect.fail(new MissingMetaRecord({ path }));
    return { meta, tasks };
  });
}

export function writeTasksJsonl(
  planDir: string,
  meta: TaskMeta,
  tasks: TaskRecord[],
): Effect.Effect<void, PlanWriteError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    yield* fs.makeDir(planDir);
    const content = [meta, ...tasks].map((record) => JSON.stringify(record)).join('\n') + '\n';
    yield* fs.writeFileAtomic(join(planDir, TASKS_FILE), content);
  });
}

export function updateTask(
  planDir: string,
  taskId: string,
  updates: Partial<Omit<TaskRecord, '_type' | 'id' | 'created_at'>>,
): Effect.Effect<
  TaskRecord,
  ReadError | PlanWriteError | TasksFileNotFound | TaskNotFound,
  FileSystem
> {
  // Serialize the read-modify-write so concurrent task updates to the same plan
  // (e.g. parallel update_task / update_tasks calls) cannot clobber each other.
  return withFileLock(
    join(planDir, TASKS_FILE),
    Effect.gen(function* () {
      const snapshot = yield* readTasksJsonl(planDir);
      if (!snapshot) return yield* Effect.fail(new TasksFileNotFound({ planDir }));

      const index = snapshot.tasks.findIndex((task) => task.id === taskId);
      if (index === -1) return yield* Effect.fail(new TaskNotFound({ planDir, taskId }));

      const updated: TaskRecord = {
        ...snapshot.tasks[index],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      snapshot.tasks[index] = updated;
      yield* writeTasksJsonl(planDir, snapshot.meta, snapshot.tasks);
      return updated;
    }),
  );
}

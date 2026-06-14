/**
 * Effect Schema definitions for plan-mode persisted records.
 *
 * These replace the hand-rolled type guards. Schemas are the single source of
 * truth for record shape; the mutable TS interfaces in `types.ts` are kept for
 * the imperative orchestration code (which mutates tasks in place) and are
 * structurally compatible with the decoded values.
 */

import { Schema } from 'effect';

export const TaskStatusSchema = Schema.Literal('pending', 'done', 'skipped', 'blocked', 'deferred');

export const TaskOriginSchema = Schema.Literal('plan', 'discovered');

export const TaskRecordSchema = Schema.Struct({
  _type: Schema.Literal('task'),
  id: Schema.String,
  description: Schema.String,
  details: Schema.optional(Schema.String),
  status: TaskStatusSchema,
  origin: Schema.optional(TaskOriginSchema),
  depends_on: Schema.optional(Schema.mutable(Schema.Array(Schema.String))),
  notes: Schema.optional(Schema.String),
  created_at: Schema.String,
  updated_at: Schema.String,
});

export const TaskMetaSchema = Schema.Struct({
  _type: Schema.Literal('meta'),
  title: Schema.String,
  plan_name: Schema.String,
  created_at: Schema.String,
  /** Optional git commit the plan was written against (back-compat: absent on older plans). */
  base_commit: Schema.optional(Schema.String),
});

/** A single tasks.jsonl line is either the meta record or a task record. */
export const TasksLineSchema = Schema.Union(TaskMetaSchema, TaskRecordSchema);

/**
 * Plan lifecycle statuses.
 *   - in-progress: active, tracked, eligible for auto-resolution
 *   - done:        completed (all tasks resolved)
 *   - superseded:  closed because another plan absorbed the work
 *   - abandoned:   closed without shipping (rejected / won't do)
 * Only `in-progress` is treated as active; the rest are terminal.
 */
export const PlanStatusSchema = Schema.Literal('in-progress', 'done', 'superseded', 'abandoned');

export const PlanManifestEntrySchema = Schema.Struct({
  _type: Schema.Literal('plan'),
  name: Schema.String,
  status: PlanStatusSchema,
  title: Schema.String,
  created_at: Schema.String,
  completed_at: Schema.NullOr(Schema.String),
  /** Optional human-readable reason, used for terminal statuses. */
  reason: Schema.optional(Schema.String),
  /** Parent initiative name (kebab). Absent = standalone flat plan. */
  initiative: Schema.optional(Schema.String),
  /**
   * Plan-level dependencies: names of plans this plan depends on. Distinct from
   * the task-level `depends_on` above. Cross-initiative references are allowed.
   */
  depends_on: Schema.optional(Schema.mutable(Schema.Array(Schema.String))),
});

/**
 * Initiative lifecycle statuses reuse the plan lifecycle literals. An
 * initiative's status is a projection of its member plans' statuses, with the
 * same terminal-guard semantics as plans.
 */
export const InitiativeStatusSchema = PlanStatusSchema;

export const InitiativeManifestEntrySchema = Schema.Struct({
  _type: Schema.Literal('initiative'),
  name: Schema.String,
  status: InitiativeStatusSchema,
  title: Schema.String,
  created_at: Schema.String,
  completed_at: Schema.NullOr(Schema.String),
  /** Optional human-readable reason, used for terminal statuses. */
  reason: Schema.optional(Schema.String),
});

export const ExecPendingConfigSchema = Schema.Struct({
  model: Schema.Struct({ provider: Schema.String, id: Schema.String }),
  thinking: Schema.String,
});

export const decodeTaskRecord = Schema.decodeUnknownEither(TaskRecordSchema);
export const decodeTaskMeta = Schema.decodeUnknownEither(TaskMetaSchema);
export const decodeTasksLine = Schema.decodeUnknownEither(TasksLineSchema);
export const decodePlanManifestEntry = Schema.decodeUnknownEither(PlanManifestEntrySchema);
export const decodeInitiativeManifestEntry = Schema.decodeUnknownEither(
  InitiativeManifestEntrySchema,
);
export const decodeExecPendingConfig = Schema.decodeUnknownEither(ExecPendingConfigSchema);

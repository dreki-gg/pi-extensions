import { Context, Effect, Layer, Schema } from "effect";
import * as _$effect_Types0 from "effect/Types";
import * as _$effect_Cause0 from "effect/Cause";
import * as _$effect_SchemaAST0 from "effect/SchemaAST";
import * as _$effect_ParseResult0 from "effect/ParseResult";
import * as _$effect_Either0 from "effect/Either";

//#region src/types.d.ts
/**
 * Shared types for plan mode.
 */
type TaskStatus = 'pending' | 'done' | 'skipped' | 'blocked' | 'deferred';
/** Where a task came from: the original submitted plan, or discovered during execution. */
type TaskOrigin = 'plan' | 'discovered';
/**
 * Plan lifecycle status. Only `in-progress` is active; `done`, `superseded`,
 * and `abandoned` are terminal and drop out of active-plan resolution.
 */
type PlanStatus = 'in-progress' | 'done' | 'superseded' | 'abandoned';
/** Initiative lifecycle reuses the plan lifecycle literals. */
type InitiativeStatus = PlanStatus;
interface TaskRecord {
  _type: 'task';
  id: string;
  description: string;
  details?: string;
  status: TaskStatus;
  /** Defaults to 'plan' when absent (back-compat with older tasks.jsonl files). */
  origin?: TaskOrigin;
  depends_on?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}
interface TaskMeta {
  _type: 'meta';
  title: string;
  plan_name: string;
  created_at: string;
  /**
   * Git commit (HEAD) the plan was written against, captured at submit time.
   * Optional for back-compat: older tasks.jsonl files predate this field, and
   * it stays undefined when git metadata is unavailable (no repo, no commits).
   */
  base_commit?: string;
}
interface PlanData {
  title: string;
  planName: string;
  handoff: string;
  tasks: TaskRecord[];
  /** Git commit the plan was written against; powers the executor drift check. */
  base_commit?: string;
}
type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
interface ExecPendingConfig {
  model: {
    provider: string;
    id: string;
  };
  thinking: string;
}
//#endregion
//#region src/errors.d.ts
/**
 * Tagged errors for plan-mode disk I/O and JSONL validation.
 *
 * These replace ad-hoc `throw new Error(...)` so storage programs surface
 * typed, inspectable failures. They are mapped back to user-facing strings at
 * the tool boundary via `errorMessage`.
 */
declare const PlanReadError_base: new <A extends Record<string, any> = {}>(args: _$effect_Types0.VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => _$effect_Cause0.YieldableError & {
  readonly _tag: "PlanReadError";
} & Readonly<A>;
declare class PlanReadError extends PlanReadError_base<{
  readonly path: string;
  readonly cause: unknown;
}> {
  get message(): string;
}
declare const PlanWriteError_base: new <A extends Record<string, any> = {}>(args: _$effect_Types0.VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => _$effect_Cause0.YieldableError & {
  readonly _tag: "PlanWriteError";
} & Readonly<A>;
declare class PlanWriteError extends PlanWriteError_base<{
  readonly path: string;
  readonly cause: unknown;
}> {
  get message(): string;
}
declare const JsonlParseError_base: new <A extends Record<string, any> = {}>(args: _$effect_Types0.VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => _$effect_Cause0.YieldableError & {
  readonly _tag: "JsonlParseError";
} & Readonly<A>;
declare class JsonlParseError extends JsonlParseError_base<{
  readonly path: string;
  readonly line: number;
  readonly cause?: unknown;
}> {
  get message(): string;
}
declare const JsonlValidationError_base: new <A extends Record<string, any> = {}>(args: _$effect_Types0.VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => _$effect_Cause0.YieldableError & {
  readonly _tag: "JsonlValidationError";
} & Readonly<A>;
declare class JsonlValidationError extends JsonlValidationError_base<{
  readonly path: string;
  readonly line: number;
  readonly reason: string;
}> {
  get message(): string;
}
declare const MissingMetaRecord_base: new <A extends Record<string, any> = {}>(args: _$effect_Types0.VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => _$effect_Cause0.YieldableError & {
  readonly _tag: "MissingMetaRecord";
} & Readonly<A>;
declare class MissingMetaRecord extends MissingMetaRecord_base<{
  readonly path: string;
}> {
  get message(): string;
}
declare const TaskNotFound_base: new <A extends Record<string, any> = {}>(args: _$effect_Types0.VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => _$effect_Cause0.YieldableError & {
  readonly _tag: "TaskNotFound";
} & Readonly<A>;
declare class TaskNotFound extends TaskNotFound_base<{
  readonly planDir: string;
  readonly taskId: string;
}> {
  get message(): string;
}
declare const TasksFileNotFound_base: new <A extends Record<string, any> = {}>(args: _$effect_Types0.VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>) => _$effect_Cause0.YieldableError & {
  readonly _tag: "TasksFileNotFound";
} & Readonly<A>;
declare class TasksFileNotFound extends TasksFileNotFound_base<{
  readonly planDir: string;
}> {
  get message(): string;
}
type PlanStorageError = PlanReadError | PlanWriteError | JsonlParseError | JsonlValidationError | MissingMetaRecord | TaskNotFound | TasksFileNotFound;
declare function causeMessage(cause: unknown): string;
declare function errorMessage(error: unknown): string;
/** Convert any error (including tagged errors) into a native Error for the tool boundary. */
declare function toNativeError(error: unknown): Error;
//#endregion
//#region src/schema.d.ts
declare const TaskStatusSchema: Schema.Literal<["pending", "done", "skipped", "blocked", "deferred"]>;
declare const TaskOriginSchema: Schema.Literal<["plan", "discovered"]>;
declare const TaskRecordSchema: Schema.Struct<{
  _type: Schema.Literal<["task"]>;
  id: typeof Schema.String;
  description: typeof Schema.String;
  details: Schema.optional<typeof Schema.String>;
  status: Schema.Literal<["pending", "done", "skipped", "blocked", "deferred"]>;
  origin: Schema.optional<Schema.Literal<["plan", "discovered"]>>;
  depends_on: Schema.optional<Schema.mutable<Schema.Array$<typeof Schema.String>>>;
  notes: Schema.optional<typeof Schema.String>;
  created_at: typeof Schema.String;
  updated_at: typeof Schema.String;
}>;
declare const TaskMetaSchema: Schema.Struct<{
  _type: Schema.Literal<["meta"]>;
  title: typeof Schema.String;
  plan_name: typeof Schema.String;
  created_at: typeof Schema.String; /** Optional git commit the plan was written against (back-compat: absent on older plans). */
  base_commit: Schema.optional<typeof Schema.String>;
}>;
/** A single tasks.jsonl line is either the meta record or a task record. */
declare const TasksLineSchema: Schema.Union<[Schema.Struct<{
  _type: Schema.Literal<["meta"]>;
  title: typeof Schema.String;
  plan_name: typeof Schema.String;
  created_at: typeof Schema.String; /** Optional git commit the plan was written against (back-compat: absent on older plans). */
  base_commit: Schema.optional<typeof Schema.String>;
}>, Schema.Struct<{
  _type: Schema.Literal<["task"]>;
  id: typeof Schema.String;
  description: typeof Schema.String;
  details: Schema.optional<typeof Schema.String>;
  status: Schema.Literal<["pending", "done", "skipped", "blocked", "deferred"]>;
  origin: Schema.optional<Schema.Literal<["plan", "discovered"]>>;
  depends_on: Schema.optional<Schema.mutable<Schema.Array$<typeof Schema.String>>>;
  notes: Schema.optional<typeof Schema.String>;
  created_at: typeof Schema.String;
  updated_at: typeof Schema.String;
}>]>;
/**
 * Plan lifecycle statuses.
 *   - in-progress: active, tracked, eligible for auto-resolution
 *   - done:        completed (all tasks resolved)
 *   - superseded:  closed because another plan absorbed the work
 *   - abandoned:   closed without shipping (rejected / won't do)
 * Only `in-progress` is treated as active; the rest are terminal.
 */
declare const PlanStatusSchema: Schema.Literal<["in-progress", "done", "superseded", "abandoned"]>;
declare const PlanManifestEntrySchema: Schema.Struct<{
  _type: Schema.Literal<["plan"]>;
  name: typeof Schema.String;
  status: Schema.Literal<["in-progress", "done", "superseded", "abandoned"]>;
  title: typeof Schema.String;
  created_at: typeof Schema.String;
  completed_at: Schema.NullOr<typeof Schema.String>; /** Optional human-readable reason, used for terminal statuses. */
  reason: Schema.optional<typeof Schema.String>; /** Parent initiative name (kebab). Absent = standalone flat plan. */
  initiative: Schema.optional<typeof Schema.String>;
  /**
   * Plan-level dependencies: names of plans this plan depends on. Distinct from
   * the task-level `depends_on` above. Cross-initiative references are allowed.
   */
  depends_on: Schema.optional<Schema.mutable<Schema.Array$<typeof Schema.String>>>;
}>;
/**
 * Initiative lifecycle statuses reuse the plan lifecycle literals. An
 * initiative's status is a projection of its member plans' statuses, with the
 * same terminal-guard semantics as plans.
 */
declare const InitiativeStatusSchema: Schema.Literal<["in-progress", "done", "superseded", "abandoned"]>;
declare const InitiativeManifestEntrySchema: Schema.Struct<{
  _type: Schema.Literal<["initiative"]>;
  name: typeof Schema.String;
  status: Schema.Literal<["in-progress", "done", "superseded", "abandoned"]>;
  title: typeof Schema.String;
  created_at: typeof Schema.String;
  completed_at: Schema.NullOr<typeof Schema.String>; /** Optional human-readable reason, used for terminal statuses. */
  reason: Schema.optional<typeof Schema.String>;
}>;
declare const ExecPendingConfigSchema: Schema.Struct<{
  model: Schema.Struct<{
    provider: typeof Schema.String;
    id: typeof Schema.String;
  }>;
  thinking: typeof Schema.String;
}>;
declare const decodeTaskRecord: (u: unknown, overrideOptions?: _$effect_SchemaAST0.ParseOptions) => _$effect_Either0.Either<{
  readonly _type: "task";
  readonly id: string;
  readonly description: string;
  readonly details?: string | undefined;
  readonly status: "pending" | "done" | "skipped" | "blocked" | "deferred";
  readonly origin?: "plan" | "discovered" | undefined;
  readonly depends_on?: string[] | undefined;
  readonly notes?: string | undefined;
  readonly created_at: string;
  readonly updated_at: string;
}, _$effect_ParseResult0.ParseError>;
declare const decodeTaskMeta: (u: unknown, overrideOptions?: _$effect_SchemaAST0.ParseOptions) => _$effect_Either0.Either<{
  readonly _type: "meta";
  readonly created_at: string;
  readonly title: string;
  readonly plan_name: string;
  readonly base_commit?: string | undefined;
}, _$effect_ParseResult0.ParseError>;
declare const decodeTasksLine: (u: unknown, overrideOptions?: _$effect_SchemaAST0.ParseOptions) => _$effect_Either0.Either<{
  readonly _type: "meta";
  readonly created_at: string;
  readonly title: string;
  readonly plan_name: string;
  readonly base_commit?: string | undefined;
} | {
  readonly _type: "task";
  readonly id: string;
  readonly description: string;
  readonly details?: string | undefined;
  readonly status: "pending" | "done" | "skipped" | "blocked" | "deferred";
  readonly origin?: "plan" | "discovered" | undefined;
  readonly depends_on?: string[] | undefined;
  readonly notes?: string | undefined;
  readonly created_at: string;
  readonly updated_at: string;
}, _$effect_ParseResult0.ParseError>;
declare const decodePlanManifestEntry: (u: unknown, overrideOptions?: _$effect_SchemaAST0.ParseOptions) => _$effect_Either0.Either<{
  readonly _type: "plan";
  readonly status: "done" | "in-progress" | "superseded" | "abandoned";
  readonly depends_on?: string[] | undefined;
  readonly created_at: string;
  readonly title: string;
  readonly name: string;
  readonly completed_at: string | null;
  readonly reason?: string | undefined;
  readonly initiative?: string | undefined;
}, _$effect_ParseResult0.ParseError>;
declare const decodeInitiativeManifestEntry: (u: unknown, overrideOptions?: _$effect_SchemaAST0.ParseOptions) => _$effect_Either0.Either<{
  readonly _type: "initiative";
  readonly status: "done" | "in-progress" | "superseded" | "abandoned";
  readonly created_at: string;
  readonly title: string;
  readonly name: string;
  readonly completed_at: string | null;
  readonly reason?: string | undefined;
}, _$effect_ParseResult0.ParseError>;
declare const decodeExecPendingConfig: (u: unknown, overrideOptions?: _$effect_SchemaAST0.ParseOptions) => _$effect_Either0.Either<{
  readonly model: {
    readonly id: string;
    readonly provider: string;
  };
  readonly thinking: string;
}, _$effect_ParseResult0.ParseError>;
//#endregion
//#region src/effects/filesystem.d.ts
interface FileSystemService {
  readonly readFileString: (path: string) => Effect.Effect<string, PlanReadError>;
  readonly writeFileString: (path: string, data: string) => Effect.Effect<void, PlanWriteError>;
  readonly writeFileAtomic: (path: string, data: string) => Effect.Effect<void, PlanWriteError>;
  readonly makeDir: (path: string) => Effect.Effect<void, PlanWriteError>;
  readonly listDirectories: (path: string) => Effect.Effect<string[], PlanReadError>;
  readonly removeFile: (path: string) => Effect.Effect<void, PlanWriteError>;
}
declare const FileSystem_base: Context.TagClass<FileSystem, "PlanMode/FileSystem", FileSystemService>;
declare class FileSystem extends FileSystem_base {}
declare const nodeFileSystemService: FileSystemService;
//#endregion
//#region src/effects/runtime.d.ts
declare function makeRuntimeLayer(): Layer.Layer<FileSystem>;
/** Build a bridge that runs storage programs against the live filesystem layer. */
declare function makePlanRuntime(): <A, E>(program: Effect.Effect<A, E, FileSystem>) => Promise<A>;
type RunPlanIO = ReturnType<typeof makePlanRuntime>;
//#endregion
//#region src/storage/task-storage.d.ts
interface TasksSnapshot {
  meta: TaskMeta;
  tasks: TaskRecord[];
}
type ReadError$3 = JsonlParseError | JsonlValidationError | MissingMetaRecord;
declare function readTasksJsonl(planDir: string): Effect.Effect<TasksSnapshot | undefined, ReadError$3, FileSystem>;
declare function writeTasksJsonl(planDir: string, meta: TaskMeta, tasks: TaskRecord[]): Effect.Effect<void, PlanWriteError, FileSystem>;
declare function updateTask(planDir: string, taskId: string, updates: Partial<Omit<TaskRecord, '_type' | 'id' | 'created_at'>>): Effect.Effect<TaskRecord, ReadError$3 | PlanWriteError | TasksFileNotFound | TaskNotFound, FileSystem>;
//#endregion
//#region src/storage/plan-storage.d.ts
declare function saveHandoff(planDir: string, content: string): Effect.Effect<void, PlanWriteError, FileSystem>;
declare function loadHandoff(planDir: string): Effect.Effect<string | undefined, never, FileSystem>;
declare function saveInitiative(initiativeDir: string, content: string): Effect.Effect<void, PlanWriteError, FileSystem>;
//#endregion
//#region src/storage/plans-manifest.d.ts
interface PlanManifestEntry {
  _type: 'plan';
  name: string;
  status: PlanStatus;
  title: string;
  created_at: string;
  completed_at: string | null;
  reason?: string;
  /** Parent initiative name (kebab). Absent = standalone flat plan. */
  initiative?: string;
  /** Plan-level dependencies (plan names). Cross-initiative allowed. */
  depends_on?: string[];
}
/** A status is terminal (closed) when it is anything other than in-progress. */
declare function isTerminalStatus(status: PlanStatus): boolean;
type ReadError$2 = JsonlParseError | JsonlValidationError;
declare function readPlansManifest(): Effect.Effect<PlanManifestEntry[], ReadError$2, FileSystem>;
declare function writePlansManifest(entries: PlanManifestEntry[]): Effect.Effect<void, PlanWriteError, FileSystem>;
interface PlanUpsert {
  status: PlanStatus;
  title?: string;
  reason?: string;
  /** Parent initiative name; preserved when omitted. */
  initiative?: string;
  /** Plan-level dependencies (plan names); preserved when omitted. */
  depends_on?: string[];
}
/**
 * Pure transform: upsert `name` into the in-memory `entries` array, preserving
 * created_at / membership / deps from any existing entry. No IO — shared by the
 * locked `upsertPlanEntry` and `reconcilePlanStatus` so both flow through one
 * serialized read-modify-write and never nest locks.
 */
declare function applyPlanUpsert(entries: PlanManifestEntry[], name: string, updates: PlanUpsert): void;
/**
 * Serialized read-modify-write of the plans registry. Holds a process-wide lock
 * on the manifest path across the whole read → transform → write so concurrent
 * tool calls cannot clobber each other (lost-update race). `transform` mutates
 * the entries array in place and returns `true` when it changed something
 * (return `false` to skip the rewrite).
 */
declare function mutatePlansManifest(transform: (entries: PlanManifestEntry[]) => boolean): Effect.Effect<void, ReadError$2 | PlanWriteError, FileSystem>;
declare function upsertPlanEntry(name: string, updates: PlanUpsert): Effect.Effect<void, ReadError$2 | PlanWriteError, FileSystem>;
/**
 * Reconcile a plan's registry status from its task state.
 *
 * The registry `status` is a PROJECTION of task state, not a parallel flag.
 * Call this wherever tasks are written so completion is never coupled to a
 * formal in-session execution run (see FEEDBACK #1). `finalizable` means every
 * active task is resolved AND no deferred follow-ups remain.
 *
 * Guard: a manually-set terminal status (`superseded` / `abandoned`) is never
 * auto-overridden — only `in-progress` ⇄ `done` is derived from tasks.
 */
declare function reconcilePlanStatus(name: string, finalizable: boolean, title?: string): Effect.Effect<void, ReadError$2 | PlanWriteError, FileSystem>;
//#endregion
//#region src/storage/initiatives-manifest.d.ts
interface InitiativeManifestEntry {
  _type: 'initiative';
  name: string;
  status: InitiativeStatus;
  title: string;
  created_at: string;
  completed_at: string | null;
  reason?: string;
}
type ReadError$1 = JsonlParseError | JsonlValidationError;
declare function readInitiativesManifest(): Effect.Effect<InitiativeManifestEntry[], ReadError$1, FileSystem>;
declare function writeInitiativesManifest(entries: InitiativeManifestEntry[]): Effect.Effect<void, PlanWriteError, FileSystem>;
interface InitiativeUpsert {
  status: InitiativeStatus;
  title?: string;
  reason?: string;
}
/**
 * Pure transform: upsert `name` into the in-memory `entries` array, preserving
 * created_at from any existing entry. No IO — shared by the locked
 * `upsertInitiativeEntry` and `reconcileInitiativeStatus` so both flow through
 * one serialized read-modify-write and never nest locks.
 */
declare function applyInitiativeUpsert(entries: InitiativeManifestEntry[], name: string, updates: InitiativeUpsert): void;
/**
 * Serialized read-modify-write of the initiatives registry. Holds a
 * process-wide lock on the manifest path across the whole read → transform →
 * write so concurrent tool calls cannot clobber each other. `transform` may run
 * IO (e.g. read the plans manifest to project status) and mutates the entries
 * array in place, returning `true` when it changed something.
 */
declare function mutateInitiativesManifest<E, R>(transform: (entries: InitiativeManifestEntry[]) => Effect.Effect<boolean, E, R>): Effect.Effect<void, ReadError$1 | PlanWriteError | E, FileSystem | R>;
declare function upsertInitiativeEntry(name: string, updates: InitiativeUpsert): Effect.Effect<void, ReadError$1 | PlanWriteError, FileSystem>;
//#endregion
//#region src/storage/atomic-write.d.ts
interface AtomicWriteOptions {
  /** Test seam: file mode for the temporary file. */
  mode?: number;
}
/**
 * Atomically write `data` to `path`: write to a temp file, fsync, rename into
 * place, then best-effort fsync the directory. Failures surface as
 * `PlanWriteError`.
 */
declare function writeFileAtomic(path: string, data: string | Buffer, options?: AtomicWriteOptions): Effect.Effect<void, PlanWriteError>;
//#endregion
//#region src/storage/file-lock.d.ts
/**
 * Run `effect` while holding the single permit for `key`. Concurrent callers
 * with the same key queue and run one at a time; the permit is always released,
 * even on failure or interruption.
 *
 * Do NOT nest `withFileLock` for the same key inside another — the permit is
 * not reentrant and would deadlock. Express composite read-modify-write as one
 * locked section instead.
 */
declare function withFileLock<A, E, R>(key: string, effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R>;
//#endregion
//#region src/task-status.d.ts
declare function deferredTasks(tasks: readonly TaskRecord[]): TaskRecord[];
/**
 * True when no active work remains — every task is done, skipped, or deferred
 * (nothing pending or blocked).
 */
declare function activeTasksResolved(tasks: readonly TaskRecord[]): boolean;
/**
 * True when the plan can be marked complete: active work is resolved AND there
 * are no deferred follow-ups awaiting the user's decision.
 */
declare function isPlanFinalizable(tasks: readonly TaskRecord[]): boolean;
/**
 * Reactivate tasks for a resumed run: blocked tasks and deferred follow-ups
 * become pending (mutated in place). Returns true if anything changed.
 */
declare function reactivateForExecution(tasks: TaskRecord[], timestamp: string): boolean;
//#endregion
//#region src/reconcile.d.ts
interface PlanDriftRow {
  name: string;
  /** Registry status, or `undefined` when there is a task dir but no entry. */
  registryStatus?: PlanStatus;
  title?: string;
  /** Derived from tasks: `done` when finalizable, else `in-progress`. */
  derivedStatus?: 'in-progress' | 'done';
  /** Resolved/total task counts when a tasks.jsonl exists. */
  resolved?: number;
  total?: number;
  /** True when a `tasks.jsonl` snapshot was found for this plan. */
  hasTasks: boolean;
  /**
   * Drift class:
   *   - 'status'        : registry status disagrees with derived task status
   *   - 'registry-only' : registry entry but no tasks.jsonl dir
   *   - 'orphan'        : tasks.jsonl dir but no registry entry
   *   - undefined       : in sync
   */
  drift?: 'status' | 'registry-only' | 'orphan';
  /**
   * For `status` drift, the direction the registry would move if projected from
   * tasks:
   *   - 'upgrade'   : registry `in-progress` → tasks `done` (safe; auto-repaired)
   *   - 'downgrade' : registry `done` → tasks `in-progress` (NOT auto-repaired)
   *
   * A downgrade almost always means "work merged but tasks were never marked
   * done" — auto-projecting tasks→registry there would REGRESS a finished plan
   * back to in-progress (the wrong direction). We surface it for a human to
   * resolve by marking the tasks done instead.
   */
  direction?: 'upgrade' | 'downgrade';
}
type CollectError = JsonlParseError | JsonlValidationError | MissingMetaRecord;
/** Walk every plan (registry + task dirs) and classify drift. Pure read. */
declare function collectPlanDrift(): Effect.Effect<PlanDriftRow[], CollectError, FileSystem>;
interface InitiativeDriftRow {
  name: string;
  registryStatus: PlanStatus;
  title: string;
  /** Projected from member plans: `done` when finalizable, else `in-progress`. */
  derivedStatus: 'in-progress' | 'done';
  members: number;
  /** 'status' when the registry status disagrees with the projection. */
  drift?: 'status';
}
/** Compare each initiative's registry status against its member-plan projection. */
declare function collectInitiativeDrift(): Effect.Effect<InitiativeDriftRow[], CollectError, FileSystem>;
/** Repair `status`-class initiative drift by re-projecting from member plans. */
declare function applyInitiativeReconcile(rows: InitiativeDriftRow[]): Effect.Effect<InitiativeDriftRow[], CollectError | PlanWriteError, FileSystem>;
/**
 * Repair `status`-class drift by projecting derived status into the registry.
 *
 * Safety: only `upgrade` drift (registry `in-progress` → tasks `done`) is
 * auto-repaired. A `downgrade` (registry `done` → tasks `in-progress`) is
 * reported but NEVER auto-applied — it almost always means work merged without
 * marking tasks done, and projecting tasks→registry there would regress a
 * finished plan. The human resolves it by marking the tasks done instead.
 *
 * Orphans and registry-only rows are likewise reported but not auto-fixed.
 * Returns the rows that were repaired.
 */
declare function applyReconcile(rows: PlanDriftRow[]): Effect.Effect<PlanDriftRow[], CollectError | PlanWriteError, FileSystem>;
//#endregion
//#region src/initiative.d.ts
interface PlanReadiness {
  name: string;
  /** True when every plan in `depends_on` is `done`. */
  ready: boolean;
  /** Dependency plan names that are not yet `done` (unknown deps count too). */
  blockedBy: string[];
}
/**
 * For each `in-progress` plan, whether all of its plan-level dependencies are
 * `done`. Only a `done` dependency unblocks — a missing, in-progress, or
 * terminally-closed (superseded/abandoned) dependency keeps a plan blocked.
 */
declare function computePlanReadiness(plans: readonly PlanManifestEntry[]): PlanReadiness[];
/** Member plans of an initiative (linked by name in the plans manifest). */
declare function membersOf(initiative: string, plans: readonly PlanManifestEntry[]): PlanManifestEntry[];
/**
 * An initiative is finalizable (`done`) when it has ≥1 member plan AND every
 * member is terminal (no member is `in-progress`). Mirrors the plan-level rule
 * one level up.
 */
declare function isInitiativeFinalizable(initiative: string, plans: readonly PlanManifestEntry[]): boolean;
interface InitiativeMemberRow {
  name: string;
  title: string;
  status: PlanStatus;
  /** Present for in-progress members. */
  ready?: boolean;
  blockedBy?: string[];
}
interface InitiativeRollup {
  name: string;
  total: number;
  done: number;
  /** Terminal but not done (superseded / abandoned). */
  closed: number;
  inProgress: number;
  ready: number;
  blocked: number;
  members: InitiativeMemberRow[];
}
/** Aggregate an initiative's member plans into counts + per-member readiness. */
declare function initiativeRollup(initiative: string, plans: readonly PlanManifestEntry[]): InitiativeRollup;
type ReconcileError = JsonlParseError | JsonlValidationError | PlanWriteError;
/**
 * Re-derive an initiative's registry status from its member plans.
 *
 * Like `reconcilePlanStatus`: only reflects state for a KNOWN initiative (never
 * conjures an entry), and never clobbers a manually-set terminal status
 * (`superseded` / `abandoned`). Only `in-progress` ⇄ `done` is derived.
 */
declare function reconcileInitiativeStatus(name: string): Effect.Effect<void, ReconcileError, FileSystem>;
/**
 * Reconcile the initiative that a given plan belongs to (no-op when the plan is
 * standalone). Call this after any plan-status write so the initiative level
 * stays in sync without callers needing to know the parent name.
 */
declare function reconcileInitiativeForPlan(planName: string): Effect.Effect<void, ReconcileError, FileSystem>;
//#endregion
//#region src/resolve.d.ts
interface ResolvedPlanName {
  /** The resolved bare plan name, when resolvable. */
  planName?: string;
  /** Plan directory (`.plans/<name>`) for the resolved plan. */
  planDir?: string;
  /** In-progress plan names, surfaced when resolution was ambiguous or missed. */
  candidates: string[];
}
type ResolveError = JsonlParseError | JsonlValidationError;
/** Normalize a plan hint (`my-plan` or `.plans/my-plan`) to a bare name. */
declare function normalizePlanName(hint: string): string;
declare function resolvePlanByName(opts?: {
  name?: string;
}): Effect.Effect<ResolvedPlanName, ResolveError, FileSystem>;
/** Build full plan data (`title, planName, handoff, tasks, base_commit`) from disk. */
declare function loadPlanData(planDir: string): Effect.Effect<PlanData | undefined, JsonlParseError | JsonlValidationError | MissingMetaRecord, FileSystem>;
//#endregion
//#region src/engine.d.ts
type ReadError = JsonlParseError | JsonlValidationError | MissingMetaRecord;
type WriteFlowError = ReadError | PlanWriteError | TasksFileNotFound;
interface UpdatedTaskResult {
  task: TaskRecord;
  finalizable: boolean;
}
/**
 * Set a task's status (and optional notes), persist, then re-project registry
 * status. Mirrors the extension's `onTaskUpdated`.
 */
declare function setTaskStatus(planDir: string, taskId: string, status: TaskStatus, notes?: string): Effect.Effect<UpdatedTaskResult, WriteFlowError | TaskNotFound, FileSystem>;
interface AddTaskInput {
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
declare function appendDeferredTask(planDir: string, input: AddTaskInput): Effect.Effect<TaskRecord, WriteFlowError, FileSystem>;
declare namespace plans_d_exports {
  export { PlanListItem, SortField, StatusFilter$1 as StatusFilter, filterPlans, formatPlanList, loadPlanListItems, parseListArgs, sortPlans };
}
type SortField = 'name' | 'date-asc' | 'date-desc' | 'tasks';
type StatusFilter$1 = 'all' | PlanStatus;
interface PlanListItem {
  name: string;
  title: string;
  status: PlanStatus;
  created_at: string;
  completed_at: string | null;
  totalTasks: number;
  doneTasks: number;
  pendingTasks: number;
}
declare function filterPlans(plans: PlanListItem[], filter: StatusFilter$1): PlanListItem[];
declare function sortPlans(plans: PlanListItem[], sort: SortField): PlanListItem[];
declare function formatPlanList(plans: PlanListItem[], filter: StatusFilter$1, sort: SortField): string;
declare function loadPlanListItems(): Effect.Effect<PlanListItem[], never, FileSystem>;
declare function parseListArgs(raw: string): {
  filter: StatusFilter$1;
  sort: SortField;
};
declare namespace initiatives_d_exports {
  export { InitiativeListItem, StatusFilter, filterInitiatives, formatInitiativeList, loadInitiativeListItems, parseInitiativeFilter };
}
type StatusFilter = 'all' | InitiativeStatus;
interface InitiativeListItem {
  name: string;
  title: string;
  status: InitiativeStatus;
  created_at: string;
  totalPlans: number;
  donePlans: number;
  ready: number;
  blocked: number;
}
declare function filterInitiatives(items: InitiativeListItem[], filter: StatusFilter): InitiativeListItem[];
declare function formatInitiativeList(items: InitiativeListItem[], filter: StatusFilter): string;
declare function loadInitiativeListItems(): Effect.Effect<InitiativeListItem[], never, FileSystem>;
declare function parseInitiativeFilter(raw: string): StatusFilter;
//#endregion
//#region src/ids.d.ts
/**
 * Pure id / name helpers shared by the engine and its consumers.
 */
declare function toKebabCase(name: string): string;
/**
 * Generate the next sequential task id (`t-NNN`) given existing ids.
 *
 * Uses the max numeric suffix of `t-<digits>` ids + 1, zero-padded to 3.
 * Falls back to `t-<count+1>` when no ids match the pattern.
 */
declare function nextTaskId(existingIds: readonly string[]): string;
//#endregion
export { AddTaskInput, type ExecPendingConfig, ExecPendingConfigSchema, FileSystem, type FileSystemService, InitiativeDriftRow, initiatives_d_exports as InitiativeListing, type InitiativeManifestEntry, InitiativeManifestEntrySchema, InitiativeMemberRow, InitiativeRollup, type InitiativeStatus, InitiativeStatusSchema, type InitiativeUpsert, JsonlParseError, JsonlValidationError, MissingMetaRecord, type PlanData, PlanDriftRow, plans_d_exports as PlanListing, type PlanManifestEntry, PlanManifestEntrySchema, PlanReadError, PlanReadiness, type PlanStatus, PlanStatusSchema, PlanStorageError, type PlanUpsert, PlanWriteError, ResolvedPlanName, type RunPlanIO, type TaskMeta, TaskMetaSchema, TaskNotFound, type TaskOrigin, TaskOriginSchema, type TaskRecord, TaskRecordSchema, type TaskStatus, TaskStatusSchema, TasksFileNotFound, TasksLineSchema, TasksSnapshot, type ThinkingLevel, UpdatedTaskResult, activeTasksResolved, appendDeferredTask, applyInitiativeReconcile, applyInitiativeUpsert, applyPlanUpsert, applyReconcile, causeMessage, collectInitiativeDrift, collectPlanDrift, computePlanReadiness, decodeExecPendingConfig, decodeInitiativeManifestEntry, decodePlanManifestEntry, decodeTaskMeta, decodeTaskRecord, decodeTasksLine, deferredTasks, errorMessage, initiativeRollup, isInitiativeFinalizable, isPlanFinalizable, isTerminalStatus, loadHandoff, loadPlanData, makePlanRuntime, makeRuntimeLayer, membersOf, mutateInitiativesManifest, mutatePlansManifest, nextTaskId, nodeFileSystemService, normalizePlanName, reactivateForExecution, readInitiativesManifest, readPlansManifest, readTasksJsonl, reconcileInitiativeForPlan, reconcileInitiativeStatus, reconcilePlanStatus, resolvePlanByName, saveHandoff, saveInitiative, setTaskStatus, toKebabCase, toNativeError, updateTask, upsertInitiativeEntry, upsertPlanEntry, withFileLock, writeFileAtomic, writeInitiativesManifest, writePlansManifest, writeTasksJsonl };
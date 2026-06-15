import { t as __exportAll } from "./chunk-CfYAbeIz.mjs";
import { Context, Data, Effect, Either, Layer, Option, Schema } from "effect";
import { mkdir, open, readFile, readdir, rename, rm, unlink, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
//#region src/errors.ts
/**
* Tagged errors for plan-mode disk I/O and JSONL validation.
*
* These replace ad-hoc `throw new Error(...)` so storage programs surface
* typed, inspectable failures. They are mapped back to user-facing strings at
* the tool boundary via `errorMessage`.
*/
var PlanReadError = class extends Data.TaggedError("PlanReadError") {
	get message() {
		return `Failed to read ${this.path}: ${causeMessage(this.cause)}`;
	}
};
var PlanWriteError = class extends Data.TaggedError("PlanWriteError") {
	get message() {
		return `Failed to write ${this.path}: ${causeMessage(this.cause)}`;
	}
};
var JsonlParseError = class extends Data.TaggedError("JsonlParseError") {
	get message() {
		return `Invalid JSONL in ${this.path} at line ${this.line}: ${causeMessage(this.cause)}`;
	}
};
var JsonlValidationError = class extends Data.TaggedError("JsonlValidationError") {
	get message() {
		return `Invalid record in ${this.path} at line ${this.line}: ${this.reason}`;
	}
};
var MissingMetaRecord = class extends Data.TaggedError("MissingMetaRecord") {
	get message() {
		return `${this.path} is missing meta record`;
	}
};
var TaskNotFound = class extends Data.TaggedError("TaskNotFound") {
	get message() {
		return `Task not found: ${this.taskId}`;
	}
};
var TasksFileNotFound = class extends Data.TaggedError("TasksFileNotFound") {
	get message() {
		return `No tasks.jsonl found in ${this.planDir}`;
	}
};
function causeMessage(cause) {
	if (cause instanceof Error) return cause.message;
	return String(cause);
}
function errorMessage(error) {
	if (error instanceof Error) return error.message;
	if (typeof error === "object" && error !== null && "message" in error) {
		const message = error.message;
		if (typeof message === "string") return message;
	}
	return String(error);
}
/** Convert any error (including tagged errors) into a native Error for the tool boundary. */
function toNativeError(error) {
	if (error instanceof Error) return error;
	const native = new Error(errorMessage(error));
	if (typeof error === "object" && error !== null && "_tag" in error) native.name = String(error._tag);
	return native;
}
//#endregion
//#region src/schema.ts
/**
* Effect Schema definitions for plan-mode persisted records.
*
* These replace the hand-rolled type guards. Schemas are the single source of
* truth for record shape; the mutable TS interfaces in `types.ts` are kept for
* the imperative orchestration code (which mutates tasks in place) and are
* structurally compatible with the decoded values.
*/
const TaskStatusSchema = Schema.Literal("pending", "done", "skipped", "blocked", "deferred");
const TaskOriginSchema = Schema.Literal("plan", "discovered");
const TaskRecordSchema = Schema.Struct({
	_type: Schema.Literal("task"),
	id: Schema.String,
	description: Schema.String,
	details: Schema.optional(Schema.String),
	status: TaskStatusSchema,
	origin: Schema.optional(TaskOriginSchema),
	depends_on: Schema.optional(Schema.mutable(Schema.Array(Schema.String))),
	notes: Schema.optional(Schema.String),
	created_at: Schema.String,
	updated_at: Schema.String
});
const TaskMetaSchema = Schema.Struct({
	_type: Schema.Literal("meta"),
	title: Schema.String,
	plan_name: Schema.String,
	created_at: Schema.String,
	/** Optional git commit the plan was written against (back-compat: absent on older plans). */
	base_commit: Schema.optional(Schema.String)
});
/** A single tasks.jsonl line is either the meta record or a task record. */
const TasksLineSchema = Schema.Union(TaskMetaSchema, TaskRecordSchema);
/**
* Plan lifecycle statuses.
*   - in-progress: active, tracked, eligible for auto-resolution
*   - done:        completed (all tasks resolved)
*   - superseded:  closed because another plan absorbed the work
*   - abandoned:   closed without shipping (rejected / won't do)
* Only `in-progress` is treated as active; the rest are terminal.
*/
const PlanStatusSchema = Schema.Literal("in-progress", "done", "superseded", "abandoned");
const PlanManifestEntrySchema = Schema.Struct({
	_type: Schema.Literal("plan"),
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
	depends_on: Schema.optional(Schema.mutable(Schema.Array(Schema.String)))
});
/**
* Initiative lifecycle statuses reuse the plan lifecycle literals. An
* initiative's status is a projection of its member plans' statuses, with the
* same terminal-guard semantics as plans.
*/
const InitiativeStatusSchema = PlanStatusSchema;
const InitiativeManifestEntrySchema = Schema.Struct({
	_type: Schema.Literal("initiative"),
	name: Schema.String,
	status: InitiativeStatusSchema,
	title: Schema.String,
	created_at: Schema.String,
	completed_at: Schema.NullOr(Schema.String),
	/** Optional human-readable reason, used for terminal statuses. */
	reason: Schema.optional(Schema.String)
});
const ExecPendingConfigSchema = Schema.Struct({
	model: Schema.Struct({
		provider: Schema.String,
		id: Schema.String
	}),
	thinking: Schema.String
});
const decodeTaskRecord = Schema.decodeUnknownEither(TaskRecordSchema);
const decodeTaskMeta = Schema.decodeUnknownEither(TaskMetaSchema);
const decodeTasksLine = Schema.decodeUnknownEither(TasksLineSchema);
const decodePlanManifestEntry = Schema.decodeUnknownEither(PlanManifestEntrySchema);
const decodeInitiativeManifestEntry = Schema.decodeUnknownEither(InitiativeManifestEntrySchema);
const decodeExecPendingConfig = Schema.decodeUnknownEither(ExecPendingConfigSchema);
//#endregion
//#region src/storage/atomic-write.ts
/**
* Atomically write `data` to `path`: write to a temp file, fsync, rename into
* place, then best-effort fsync the directory. Failures surface as
* `PlanWriteError`.
*/
function writeFileAtomic(path, data, options = {}) {
	return Effect.tryPromise({
		try: () => writeFileAtomicPromise(path, data, options),
		catch: (cause) => new PlanWriteError({
			path,
			cause
		})
	});
}
async function writeFileAtomicPromise(path, data, options) {
	const dir = dirname(path);
	const tempPath = join(dir, `.${process.pid}.${randomUUID()}.tmp`);
	let completed = false;
	try {
		await writeAndSync(tempPath, data, options.mode);
		await rename(tempPath, path);
		completed = true;
		await syncDirectory(dir);
	} finally {
		if (!completed) await rm(tempPath, { force: true }).catch(() => void 0);
	}
}
async function writeAndSync(path, data, mode) {
	await new Promise((resolve, reject) => {
		const stream = createWriteStream(path, {
			flags: "wx",
			mode
		});
		stream.once("error", reject);
		stream.once("finish", resolve);
		stream.end(data);
	});
	const handle = await open(path, "r+");
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}
async function syncDirectory(dir) {
	const handle = await open(dir, "r").catch(() => void 0);
	if (!handle) return;
	try {
		await handle.sync().catch(() => void 0);
	} finally {
		await handle.close().catch(() => void 0);
	}
}
//#endregion
//#region src/effects/filesystem.ts
/**
* FileSystem service — the single seam for plan-mode disk I/O.
*
* Storage programs depend on this `Context.Tag` rather than touching
* `node:fs/promises` directly, which makes them trivially testable and keeps
* all failure modes typed (`PlanReadError` / `PlanWriteError`).
*/
var FileSystem = class extends Context.Tag("PlanMode/FileSystem")() {};
const nodeFileSystemService = {
	readFileString: (path) => Effect.tryPromise({
		try: () => readFile(path, "utf-8"),
		catch: (cause) => new PlanReadError({
			path,
			cause
		})
	}),
	writeFileString: (path, data) => Effect.tryPromise({
		try: () => writeFile(path, data, "utf-8"),
		catch: (cause) => new PlanWriteError({
			path,
			cause
		})
	}),
	writeFileAtomic: (path, data) => writeFileAtomic(path, data),
	makeDir: (path) => Effect.tryPromise({
		try: async () => {
			await mkdir(path, { recursive: true });
		},
		catch: (cause) => new PlanWriteError({
			path,
			cause
		})
	}),
	listDirectories: (path) => Effect.tryPromise({
		try: async () => {
			return (await readdir(path, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
		},
		catch: (cause) => new PlanReadError({
			path,
			cause
		})
	}),
	removeFile: (path) => Effect.tryPromise({
		try: () => unlink(path),
		catch: (cause) => new PlanWriteError({
			path,
			cause
		})
	})
};
//#endregion
//#region src/effects/runtime.ts
/**
* Live Effect runtime for the plan-mode extension.
*
* Build the layer once inside the extension entry and run storage programs
* through the `runPlanIO` bridge so the imperative pi event handlers keep their
* `await fn(...)` shape.
*/
function makeRuntimeLayer() {
	return Layer.succeed(FileSystem, nodeFileSystemService);
}
/** Build a bridge that runs storage programs against the live filesystem layer. */
function makePlanRuntime() {
	const layer = makeRuntimeLayer();
	return function runPlanIO(program) {
		return Effect.runPromise(program.pipe(Effect.provide(layer)));
	};
}
//#endregion
//#region src/storage/file-lock.ts
/**
* Process-wide keyed mutex for serializing read-modify-write on shared files.
*
* Pi runs every tool call in a single Node process. When several tool calls run
* in one block (e.g. three `submit_initiative` calls, or concurrent
* `submit_plan` / `revise_plan`), each does an independent
* read → modify → write against the same registry file. Without serialization
* their reads all observe the same starting state and the last write clobbers
* the rest — a classic lost-update race.
*
* `withFileLock` wraps a read-modify-write critical section so only one runs at
* a time per `key` (the registry path). The semaphore is created eagerly with
* `unsafeMakeSemaphore` and cached per key, so its permit count lives in plain
* shared memory and serializes correctly even across independent
* `Effect.runPromise` invocations (separate tool executes).
*
* NOTE: this guards against in-process concurrency only. Atomic writes
* (`writeFileAtomic`) still protect against torn files from other processes,
* but cross-process registry coordination is out of scope.
*/
const locks = /* @__PURE__ */ new Map();
function lockFor(key) {
	let lock = locks.get(key);
	if (!lock) {
		lock = Effect.unsafeMakeSemaphore(1);
		locks.set(key, lock);
	}
	return lock;
}
/**
* Run `effect` while holding the single permit for `key`. Concurrent callers
* with the same key queue and run one at a time; the permit is always released,
* even on failure or interruption.
*
* Do NOT nest `withFileLock` for the same key inside another — the permit is
* not reentrant and would deadlock. Express composite read-modify-write as one
* locked section instead.
*/
function withFileLock(key, effect) {
	return Effect.suspend(() => lockFor(key).withPermits(1)(effect));
}
//#endregion
//#region src/storage/task-storage.ts
const TASKS_FILE = "tasks.jsonl";
function readTasksJsonl(planDir) {
	const path = join(planDir, TASKS_FILE);
	return Effect.gen(function* () {
		const fs = yield* FileSystem;
		const maybeText = yield* Effect.option(fs.readFileString(path));
		if (Option.isNone(maybeText)) return void 0;
		const text = maybeText.value;
		if (!text.trim()) return yield* Effect.fail(new MissingMetaRecord({ path }));
		let meta;
		const tasks = [];
		for (const [index, raw] of text.split(/\r?\n/).entries()) {
			if (!raw.trim()) continue;
			const line = index + 1;
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch (cause) {
				return yield* Effect.fail(new JsonlParseError({
					path,
					line,
					cause
				}));
			}
			const decoded = decodeTasksLine(parsed);
			if (Either.isLeft(decoded)) return yield* Effect.fail(new JsonlValidationError({
				path,
				line,
				reason: decoded.left.message
			}));
			const record = decoded.right;
			if (record._type === "meta") meta = record;
			else tasks.push(record);
		}
		if (!meta) return yield* Effect.fail(new MissingMetaRecord({ path }));
		return {
			meta,
			tasks
		};
	});
}
function writeTasksJsonl(planDir, meta, tasks) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem;
		yield* fs.makeDir(planDir);
		const content = [meta, ...tasks].map((record) => JSON.stringify(record)).join("\n") + "\n";
		yield* fs.writeFileAtomic(join(planDir, TASKS_FILE), content);
	});
}
function updateTask(planDir, taskId, updates) {
	return withFileLock(join(planDir, TASKS_FILE), Effect.gen(function* () {
		const snapshot = yield* readTasksJsonl(planDir);
		if (!snapshot) return yield* Effect.fail(new TasksFileNotFound({ planDir }));
		const index = snapshot.tasks.findIndex((task) => task.id === taskId);
		if (index === -1) return yield* Effect.fail(new TaskNotFound({
			planDir,
			taskId
		}));
		const updated = {
			...snapshot.tasks[index],
			...updates,
			updated_at: (/* @__PURE__ */ new Date()).toISOString()
		};
		snapshot.tasks[index] = updated;
		yield* writeTasksJsonl(planDir, snapshot.meta, snapshot.tasks);
		return updated;
	}));
}
//#endregion
//#region src/storage/plan-storage.ts
/**
* Plan document I/O — handoff and initiative markdown documents.
*
* The pi-specific exec-pending marker helpers live in the pi extension; this
* engine package only needs the durable plan documents.
*/
function saveHandoff(planDir, content) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem;
		yield* fs.makeDir(planDir);
		yield* fs.writeFileString(`${planDir}/HANDOFF.md`, content);
	});
}
function loadHandoff(planDir) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem;
		const maybeText = yield* Effect.option(fs.readFileString(`${planDir}/HANDOFF.md`));
		return Option.getOrUndefined(maybeText);
	});
}
function saveInitiative(initiativeDir, content) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem;
		yield* fs.makeDir(initiativeDir);
		yield* fs.writeFileString(`${initiativeDir}/INITIATIVE.md`, content);
	});
}
//#endregion
//#region src/storage/plans-manifest.ts
const MANIFEST_DIR$1 = ".plans";
const MANIFEST_PATH$1 = ".plans/plans.jsonl";
/** A status is terminal (closed) when it is anything other than in-progress. */
function isTerminalStatus$1(status) {
	return status !== "in-progress";
}
function readPlansManifest() {
	return Effect.gen(function* () {
		const fs = yield* FileSystem;
		const maybeText = yield* Effect.option(fs.readFileString(MANIFEST_PATH$1));
		if (Option.isNone(maybeText)) return [];
		const entries = [];
		for (const [index, raw] of maybeText.value.split(/\r?\n/).entries()) {
			if (!raw.trim()) continue;
			const line = index + 1;
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch (cause) {
				return yield* Effect.fail(new JsonlParseError({
					path: MANIFEST_PATH$1,
					line,
					cause
				}));
			}
			const decoded = decodePlanManifestEntry(parsed);
			if (Either.isLeft(decoded)) return yield* Effect.fail(new JsonlValidationError({
				path: MANIFEST_PATH$1,
				line,
				reason: decoded.left.message
			}));
			entries.push(decoded.right);
		}
		return entries;
	});
}
function writePlansManifest(entries) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem;
		yield* fs.makeDir(MANIFEST_DIR$1);
		const content = entries.map((entry) => JSON.stringify(entry)).join("\n") + (entries.length ? "\n" : "");
		yield* fs.writeFileAtomic(MANIFEST_PATH$1, content);
	});
}
/**
* Pure transform: upsert `name` into the in-memory `entries` array, preserving
* created_at / membership / deps from any existing entry. No IO — shared by the
* locked `upsertPlanEntry` and `reconcilePlanStatus` so both flow through one
* serialized read-modify-write and never nest locks.
*/
function applyPlanUpsert(entries, name, updates) {
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const index = entries.findIndex((entry) => entry.name === name);
	const existing = index === -1 ? void 0 : entries[index];
	const entry = {
		_type: "plan",
		name,
		status: updates.status,
		title: updates.title ?? existing?.title ?? "Untitled plan",
		created_at: existing?.created_at ?? now,
		completed_at: isTerminalStatus$1(updates.status) ? existing?.completed_at ?? now : null,
		reason: updates.reason ?? existing?.reason,
		initiative: updates.initiative ?? existing?.initiative,
		depends_on: updates.depends_on ?? existing?.depends_on
	};
	if (index === -1) entries.push(entry);
	else entries[index] = entry;
}
/**
* Serialized read-modify-write of the plans registry. Holds a process-wide lock
* on the manifest path across the whole read → transform → write so concurrent
* tool calls cannot clobber each other (lost-update race). `transform` mutates
* the entries array in place and returns `true` when it changed something
* (return `false` to skip the rewrite).
*/
function mutatePlansManifest(transform) {
	return withFileLock(MANIFEST_PATH$1, Effect.gen(function* () {
		const entries = yield* readPlansManifest();
		if (transform(entries)) yield* writePlansManifest(entries);
	}));
}
function upsertPlanEntry(name, updates) {
	return mutatePlansManifest((entries) => {
		applyPlanUpsert(entries, name, updates);
		return true;
	});
}
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
function reconcilePlanStatus(name, finalizable, title) {
	return mutatePlansManifest((entries) => {
		const existing = entries.find((entry) => entry.name === name);
		if (!existing) return false;
		if (existing.status === "superseded" || existing.status === "abandoned") return false;
		const status = finalizable ? "done" : "in-progress";
		if (existing.status === status) return false;
		applyPlanUpsert(entries, name, {
			status,
			title
		});
		return true;
	});
}
//#endregion
//#region src/storage/initiatives-manifest.ts
/**
* `.plans/initiatives.jsonl` registry — the initiative-level sibling of
* `plans-manifest.ts`.
*
* An initiative groups multiple plans. Its `status` is a PROJECTION of its
* member plans' statuses (see `reconcileInitiativeStatus` in `../initiative.ts`
* for the projection wiring): `done` when every member plan is terminal,
* `in-progress` otherwise. Manually-set terminal statuses (`superseded` /
* `abandoned` via `update_initiative`) are never auto-overridden.
*
* This module is intentionally dependency-light: it knows how to read/write the
* registry. The projection (which must read the PLANS manifest) lives in
* `../initiative.ts` to keep the dependency direction one-way and cycle-free.
*/
const MANIFEST_DIR = ".plans";
const MANIFEST_PATH = ".plans/initiatives.jsonl";
/** A status is terminal (closed) when it is anything other than in-progress. */
function isTerminalStatus(status) {
	return status !== "in-progress";
}
function readInitiativesManifest() {
	return Effect.gen(function* () {
		const fs = yield* FileSystem;
		const maybeText = yield* Effect.option(fs.readFileString(MANIFEST_PATH));
		if (Option.isNone(maybeText)) return [];
		const entries = [];
		for (const [index, raw] of maybeText.value.split(/\r?\n/).entries()) {
			if (!raw.trim()) continue;
			const line = index + 1;
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch (cause) {
				return yield* Effect.fail(new JsonlParseError({
					path: MANIFEST_PATH,
					line,
					cause
				}));
			}
			const decoded = decodeInitiativeManifestEntry(parsed);
			if (Either.isLeft(decoded)) return yield* Effect.fail(new JsonlValidationError({
				path: MANIFEST_PATH,
				line,
				reason: decoded.left.message
			}));
			entries.push(decoded.right);
		}
		return entries;
	});
}
function writeInitiativesManifest(entries) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem;
		yield* fs.makeDir(MANIFEST_DIR);
		const content = entries.map((entry) => JSON.stringify(entry)).join("\n") + (entries.length ? "\n" : "");
		yield* fs.writeFileAtomic(MANIFEST_PATH, content);
	});
}
/**
* Pure transform: upsert `name` into the in-memory `entries` array, preserving
* created_at from any existing entry. No IO — shared by the locked
* `upsertInitiativeEntry` and `reconcileInitiativeStatus` so both flow through
* one serialized read-modify-write and never nest locks.
*/
function applyInitiativeUpsert(entries, name, updates) {
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const index = entries.findIndex((entry) => entry.name === name);
	const existing = index === -1 ? void 0 : entries[index];
	const entry = {
		_type: "initiative",
		name,
		status: updates.status,
		title: updates.title ?? existing?.title ?? "Untitled initiative",
		created_at: existing?.created_at ?? now,
		completed_at: isTerminalStatus(updates.status) ? existing?.completed_at ?? now : null,
		reason: updates.reason ?? existing?.reason
	};
	if (index === -1) entries.push(entry);
	else entries[index] = entry;
}
/**
* Serialized read-modify-write of the initiatives registry. Holds a
* process-wide lock on the manifest path across the whole read → transform →
* write so concurrent tool calls cannot clobber each other. `transform` may run
* IO (e.g. read the plans manifest to project status) and mutates the entries
* array in place, returning `true` when it changed something.
*/
function mutateInitiativesManifest(transform) {
	return withFileLock(MANIFEST_PATH, Effect.gen(function* () {
		const entries = yield* readInitiativesManifest();
		if (yield* transform(entries)) yield* writeInitiativesManifest(entries);
	}));
}
function upsertInitiativeEntry(name, updates) {
	return mutateInitiativesManifest((entries) => Effect.sync(() => {
		applyInitiativeUpsert(entries, name, updates);
		return true;
	}));
}
//#endregion
//#region src/task-status.ts
function deferredTasks(tasks) {
	return tasks.filter((task) => task.status === "deferred");
}
/**
* True when no active work remains — every task is done, skipped, or deferred
* (nothing pending or blocked).
*/
function activeTasksResolved(tasks) {
	return tasks.every((task) => task.status === "done" || task.status === "skipped" || task.status === "deferred");
}
/**
* True when the plan can be marked complete: active work is resolved AND there
* are no deferred follow-ups awaiting the user's decision.
*/
function isPlanFinalizable(tasks) {
	return activeTasksResolved(tasks) && !tasks.some((task) => task.status === "deferred");
}
/**
* Reactivate tasks for a resumed run: blocked tasks and deferred follow-ups
* become pending (mutated in place). Returns true if anything changed.
*/
function reactivateForExecution(tasks, timestamp) {
	let changed = false;
	for (const task of tasks) if (task.status === "blocked" || task.status === "deferred") {
		task.status = "pending";
		task.updated_at = timestamp;
		changed = true;
	}
	return changed;
}
//#endregion
//#region src/initiative.ts
/**
* Initiative logic — ready-work computation and the initiative→plan projection.
*
* Two layers live here:
*   - PURE: `computePlanReadiness`, `isInitiativeFinalizable`, `initiativeRollup`
*     reason over a plans-manifest snapshot with no IO. They are the basis for
*     "what work is unblocked right now" — the foundation for phase-2 subagent
*     fan-out.
*   - IO: `reconcileInitiativeStatus` / `reconcileInitiativeForPlan` keep an
*     initiative's registry status a PROJECTION of its member plans, mirroring
*     `reconcilePlanStatus` one level up. They read the PLANS manifest, so they
*     live here (not in `initiatives-manifest.ts`) to keep the dependency
*     direction one-way: initiative.ts → {plans-manifest, initiatives-manifest}.
*/
/**
* For each `in-progress` plan, whether all of its plan-level dependencies are
* `done`. Only a `done` dependency unblocks — a missing, in-progress, or
* terminally-closed (superseded/abandoned) dependency keeps a plan blocked.
*/
function computePlanReadiness(plans) {
	const statusByName = new Map(plans.map((plan) => [plan.name, plan.status]));
	return plans.filter((plan) => plan.status === "in-progress").map((plan) => {
		const blockedBy = (plan.depends_on ?? []).filter((dep) => statusByName.get(dep) !== "done");
		return {
			name: plan.name,
			ready: blockedBy.length === 0,
			blockedBy
		};
	});
}
/** Member plans of an initiative (linked by name in the plans manifest). */
function membersOf(initiative, plans) {
	return plans.filter((plan) => plan.initiative === initiative);
}
/**
* An initiative is finalizable (`done`) when it has ≥1 member plan AND every
* member is terminal (no member is `in-progress`). Mirrors the plan-level rule
* one level up.
*/
function isInitiativeFinalizable(initiative, plans) {
	const members = membersOf(initiative, plans);
	if (members.length === 0) return false;
	return members.every((plan) => plan.status !== "in-progress");
}
/** Aggregate an initiative's member plans into counts + per-member readiness. */
function initiativeRollup(initiative, plans) {
	const members = membersOf(initiative, plans);
	const readiness = new Map(computePlanReadiness(plans).map((row) => [row.name, row]));
	let done = 0;
	let closed = 0;
	let inProgress = 0;
	let ready = 0;
	let blocked = 0;
	const rows = members.map((plan) => {
		if (plan.status === "done") done += 1;
		else if (plan.status === "in-progress") inProgress += 1;
		else closed += 1;
		const row = {
			name: plan.name,
			title: plan.title,
			status: plan.status
		};
		if (plan.status === "in-progress") {
			const r = readiness.get(plan.name);
			row.ready = r?.ready ?? true;
			row.blockedBy = r?.blockedBy ?? [];
			if (row.ready) ready += 1;
			else blocked += 1;
		}
		return row;
	});
	return {
		name: initiative,
		total: members.length,
		done,
		closed,
		inProgress,
		ready,
		blocked,
		members: rows
	};
}
/**
* Re-derive an initiative's registry status from its member plans.
*
* Like `reconcilePlanStatus`: only reflects state for a KNOWN initiative (never
* conjures an entry), and never clobbers a manually-set terminal status
* (`superseded` / `abandoned`). Only `in-progress` ⇄ `done` is derived.
*/
function reconcileInitiativeStatus(name) {
	return mutateInitiativesManifest((initiatives) => Effect.gen(function* () {
		const existing = initiatives.find((entry) => entry.name === name);
		if (!existing) return false;
		if (existing.status === "superseded" || existing.status === "abandoned") return false;
		const status = isInitiativeFinalizable(name, yield* readPlansManifest()) ? "done" : "in-progress";
		if (existing.status === status) return false;
		applyInitiativeUpsert(initiatives, name, {
			status,
			title: existing.title
		});
		return true;
	}));
}
/**
* Reconcile the initiative that a given plan belongs to (no-op when the plan is
* standalone). Call this after any plan-status write so the initiative level
* stays in sync without callers needing to know the parent name.
*/
function reconcileInitiativeForPlan(planName) {
	return Effect.gen(function* () {
		const plan = (yield* readPlansManifest()).find((entry) => entry.name === planName);
		if (!plan?.initiative) return;
		yield* reconcileInitiativeStatus(plan.initiative);
	});
}
//#endregion
//#region src/reconcile.ts
/**
* Drift detection + repair between `tasks.jsonl` reality and registry status.
*
* Drift happens in both directions (FEEDBACK #6):
*   - tasks all done but registry `in-progress` (completion never recorded), and
*   - registry `in-progress`/`done` disagreeing with task state generally.
*
* It also surfaces two un-trackable classes:
*   - registry-only plans (an entry with no `tasks.jsonl` directory), and
*   - orphan task dirs (a `tasks.jsonl` with no registry entry).
*
* `collectPlanDrift` is a pure read; `applyReconcile` repairs only the safe
* `in-progress` ⇄ `done` projection and never touches terminal statuses.
*/
const PLANS_DIR = ".plans";
/** Walk every plan (registry + task dirs) and classify drift. Pure read. */
function collectPlanDrift() {
	return Effect.gen(function* () {
		const fs = yield* FileSystem;
		const manifest = yield* readPlansManifest();
		const dirs = yield* Effect.orElseSucceed(fs.listDirectories(PLANS_DIR), () => []);
		const taskDirs = new Set(dirs.filter((name) => !name.startsWith(".")));
		const rows = [];
		const seen = /* @__PURE__ */ new Set();
		for (const entry of manifest) {
			seen.add(entry.name);
			const snapshot = yield* readTasksJsonl(`${PLANS_DIR}/${entry.name}`);
			if (!snapshot) {
				rows.push({
					name: entry.name,
					registryStatus: entry.status,
					title: entry.title,
					hasTasks: false,
					drift: "registry-only"
				});
				continue;
			}
			const total = snapshot.tasks.length;
			const resolved = snapshot.tasks.filter((t) => t.status === "done" || t.status === "skipped").length;
			const derivedStatus = isPlanFinalizable(snapshot.tasks) ? "done" : "in-progress";
			const drift = !(entry.status === "superseded" || entry.status === "abandoned") && entry.status !== derivedStatus ? "status" : void 0;
			const direction = drift === "status" ? derivedStatus === "done" ? "upgrade" : "downgrade" : void 0;
			rows.push({
				name: entry.name,
				registryStatus: entry.status,
				title: entry.title,
				derivedStatus,
				resolved,
				total,
				hasTasks: true,
				drift,
				direction
			});
		}
		for (const name of taskDirs) {
			if (seen.has(name)) continue;
			const snapshot = yield* readTasksJsonl(`${PLANS_DIR}/${name}`);
			if (!snapshot) continue;
			const total = snapshot.tasks.length;
			const resolved = snapshot.tasks.filter((t) => t.status === "done" || t.status === "skipped").length;
			rows.push({
				name,
				title: snapshot.meta.title,
				derivedStatus: isPlanFinalizable(snapshot.tasks) ? "done" : "in-progress",
				resolved,
				total,
				hasTasks: true,
				drift: "orphan"
			});
		}
		return rows;
	});
}
/** Compare each initiative's registry status against its member-plan projection. */
function collectInitiativeDrift() {
	return Effect.gen(function* () {
		const initiatives = yield* readInitiativesManifest();
		const plans = yield* readPlansManifest();
		return initiatives.map((entry) => {
			const derivedStatus = isInitiativeFinalizable(entry.name, plans) ? "done" : "in-progress";
			const drift = !(entry.status === "superseded" || entry.status === "abandoned") && entry.status !== derivedStatus ? "status" : void 0;
			return {
				name: entry.name,
				registryStatus: entry.status,
				title: entry.title,
				derivedStatus,
				members: membersOf(entry.name, plans).length,
				drift
			};
		});
	});
}
/** Repair `status`-class initiative drift by re-projecting from member plans. */
function applyInitiativeReconcile(rows) {
	return Effect.gen(function* () {
		const repaired = [];
		for (const row of rows) {
			if (row.drift !== "status") continue;
			yield* reconcileInitiativeStatus(row.name);
			repaired.push(row);
		}
		return repaired;
	});
}
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
function applyReconcile(rows) {
	return Effect.gen(function* () {
		const repaired = [];
		for (const row of rows) {
			if (row.drift !== "status" || !row.derivedStatus) continue;
			if (row.direction === "downgrade") continue;
			yield* reconcilePlanStatus(row.name, row.derivedStatus === "done", row.title);
			yield* reconcileInitiativeForPlan(row.name);
			repaired.push(row);
		}
		return repaired;
	});
}
//#endregion
//#region src/resolve.ts
/**
* Stateless, disk-backed plan resolution.
*
* Unlike the pi extension's `resolve-plan.ts` (which also juggles session
* `state`), this is pure manifest + tasks-file resolution: given an optional
* `name` hint, return the resolved plan name or the in-progress candidates so a
* caller (CLI, automation) can act without any session.
*
* Order: explicit `name` hint → the single in-progress plan in
* `.plans/plans.jsonl`. Ambiguous (multiple in-progress, no hint) returns
* `{ planName: undefined, candidates }`.
*/
/** Normalize a plan hint (`my-plan` or `.plans/my-plan`) to a bare name. */
function normalizePlanName(hint) {
	return hint.replace(/^\.plans\//, "").replace(/\/+$/, "").trim();
}
function resolvePlanByName(opts = {}) {
	return Effect.gen(function* () {
		const manifest = yield* readPlansManifest();
		if (opts.name) {
			const hint = normalizePlanName(opts.name);
			const match = manifest.find((entry) => entry.name === hint);
			if (match) return {
				planName: match.name,
				planDir: `.plans/${match.name}`,
				candidates: []
			};
			return {
				planName: void 0,
				candidates: manifest.filter((entry) => entry.status === "in-progress").map((entry) => entry.name)
			};
		}
		const inProgress = manifest.filter((entry) => entry.status === "in-progress");
		if (inProgress.length === 1) {
			const name = inProgress[0].name;
			return {
				planName: name,
				planDir: `.plans/${name}`,
				candidates: []
			};
		}
		return {
			planName: void 0,
			candidates: inProgress.map((entry) => entry.name)
		};
	});
}
/** Build full plan data (`title, planName, handoff, tasks, base_commit`) from disk. */
function loadPlanData(planDir) {
	return Effect.gen(function* () {
		const snapshot = yield* readTasksJsonl(planDir);
		if (!snapshot) return void 0;
		const handoff = yield* loadHandoff(planDir);
		return {
			title: snapshot.meta.title,
			planName: snapshot.meta.plan_name,
			handoff: handoff ?? "",
			tasks: snapshot.tasks,
			base_commit: snapshot.meta.base_commit
		};
	});
}
//#endregion
//#region src/ids.ts
/**
* Pure id / name helpers shared by the engine and its consumers.
*/
function toKebabCase(name) {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
/**
* Generate the next sequential task id (`t-NNN`) given existing ids.
*
* Uses the max numeric suffix of `t-<digits>` ids + 1, zero-padded to 3.
* Falls back to `t-<count+1>` when no ids match the pattern.
*/
function nextTaskId(existingIds) {
	let max = 0;
	let matched = false;
	for (const id of existingIds) {
		const m = /^t-(\d+)$/.exec(id);
		if (!m) continue;
		matched = true;
		const n = Number.parseInt(m[1], 10);
		if (n > max) max = n;
	}
	const next = matched ? max + 1 : existingIds.length + 1;
	return `t-${String(next).padStart(3, "0")}`;
}
//#endregion
//#region src/engine.ts
/**
* High-level task-management operations that compose storage writes with the
* registry/initiative status projection — the same flow the pi extension runs
* inline on every task write. Consumers (CLI, automation) should call these
* rather than re-implementing the write→reconcile sequence.
*/
/** Re-derive plan + parent-initiative registry status from current task state. */
function reconcileFromTasks(planName, tasks, title) {
	return Effect.gen(function* () {
		yield* reconcilePlanStatus(planName, isPlanFinalizable(tasks), title);
		yield* reconcileInitiativeForPlan(planName);
	});
}
/**
* Set a task's status (and optional notes), persist, then re-project registry
* status. Mirrors the extension's `onTaskUpdated`.
*/
function setTaskStatus(planDir, taskId, status, notes) {
	return Effect.gen(function* () {
		const snapshot = yield* readTasksJsonl(planDir);
		if (!snapshot) return yield* Effect.fail(new TasksFileNotFound({ planDir }));
		const task = snapshot.tasks.find((t) => t.id === taskId);
		if (!task) return yield* Effect.fail(new TaskNotFound({
			planDir,
			taskId
		}));
		task.status = status;
		task.updated_at = (/* @__PURE__ */ new Date()).toISOString();
		if (notes) task.notes = notes;
		yield* writeTasksJsonl(planDir, snapshot.meta, snapshot.tasks);
		yield* reconcileFromTasks(snapshot.meta.plan_name, snapshot.tasks, snapshot.meta.title);
		return {
			task,
			finalizable: isPlanFinalizable(snapshot.tasks)
		};
	});
}
/**
* Append a discovered follow-up as a `deferred` task, persist, then re-project
* registry status (a new deferred task can re-open a done plan). Mirrors the
* extension's `add_task` + `onTaskAdded`.
*/
function appendDeferredTask(planDir, input) {
	return Effect.gen(function* () {
		const snapshot = yield* readTasksJsonl(planDir);
		if (!snapshot) return yield* Effect.fail(new TasksFileNotFound({ planDir }));
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const task = {
			_type: "task",
			id: nextTaskId(snapshot.tasks.map((t) => t.id)),
			description: input.description.slice(0, 60),
			details: input.details ?? "",
			status: "deferred",
			origin: "discovered",
			depends_on: input.depends_on,
			notes: input.reason,
			created_at: now,
			updated_at: now
		};
		snapshot.tasks.push(task);
		yield* writeTasksJsonl(planDir, snapshot.meta, snapshot.tasks);
		yield* reconcileFromTasks(snapshot.meta.plan_name, snapshot.tasks, snapshot.meta.title);
		return task;
	});
}
//#endregion
//#region src/listing/plans.ts
/**
* Pure + Effect helpers for listing plans (the engine half of the pi `/plans`
* command). The interactive pi handler lives in the extension.
*/
var plans_exports = /* @__PURE__ */ __exportAll({
	filterPlans: () => filterPlans,
	formatPlanList: () => formatPlanList,
	loadPlanListItems: () => loadPlanListItems,
	parseListArgs: () => parseListArgs,
	sortPlans: () => sortPlans
});
function filterPlans(plans, filter) {
	if (filter === "all") return plans;
	return plans.filter((p) => p.status === filter);
}
function sortPlans(plans, sort) {
	const sorted = [...plans];
	switch (sort) {
		case "name":
			sorted.sort((a, b) => a.name.localeCompare(b.name));
			break;
		case "date-asc":
			sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
			break;
		case "date-desc":
			sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
			break;
		case "tasks":
			sorted.sort((a, b) => b.totalTasks - a.totalTasks);
			break;
	}
	return sorted;
}
const STATUS_ICON$1 = {
	"in-progress": "🔵",
	done: "✅",
	superseded: "🔄",
	abandoned: "❌"
};
function formatPlanList(plans, filter, sort) {
	if (plans.length === 0) return filter === "all" ? "No plans found in .plans/plans.jsonl" : `No plans with status "${filter}"`;
	const sortLabel = {
		name: "name",
		"date-asc": "oldest first",
		"date-desc": "newest first",
		tasks: "most tasks first"
	};
	return `${filter === "all" ? `All plans (${plans.length}) — sorted by ${sortLabel[sort]}` : `Plans: ${filter} (${plans.length}) — sorted by ${sortLabel[sort]}`}\n${plans.map((p) => {
		const icon = STATUS_ICON$1[p.status];
		const progress = p.totalTasks > 0 ? ` [${p.doneTasks}/${p.totalTasks} tasks]` : " [no tasks]";
		const date = p.created_at.slice(0, 10);
		return `  ${icon} ${p.name} — ${p.title}${progress}  (${date})`;
	}).join("\n")}`;
}
function loadPlanListItems() {
	return Effect.gen(function* () {
		const manifest = yield* Effect.orElseSucceed(readPlansManifest(), () => []);
		const items = [];
		for (const entry of manifest) {
			const dir = `.plans/${entry.name}`;
			const snapshot = yield* Effect.orElseSucceed(readTasksJsonl(dir), () => void 0);
			const totalTasks = snapshot?.tasks.length ?? 0;
			const doneTasks = snapshot?.tasks.filter((t) => t.status === "done" || t.status === "skipped").length ?? 0;
			const pendingTasks = snapshot?.tasks.filter((t) => t.status === "pending").length ?? 0;
			items.push({
				name: entry.name,
				title: entry.title,
				status: entry.status,
				created_at: entry.created_at,
				completed_at: entry.completed_at,
				totalTasks,
				doneTasks,
				pendingTasks
			});
		}
		return items;
	});
}
const FILTER_ALIASES$1 = {
	all: "all",
	"in-progress": "in-progress",
	pending: "in-progress",
	active: "in-progress",
	done: "done",
	completed: "done",
	superseded: "superseded",
	abandoned: "abandoned"
};
const SORT_ALIASES = {
	name: "name",
	"date-asc": "date-asc",
	oldest: "date-asc",
	"date-desc": "date-desc",
	newest: "date-desc",
	tasks: "tasks",
	"task-count": "tasks"
};
function parseListArgs(raw) {
	const tokens = raw.toLowerCase().split(/\s+/);
	let filter = "all";
	let sort = "date-desc";
	for (const token of tokens) if (FILTER_ALIASES$1[token]) filter = FILTER_ALIASES$1[token];
	else if (SORT_ALIASES[token]) sort = SORT_ALIASES[token];
	return {
		filter,
		sort
	};
}
//#endregion
//#region src/listing/initiatives.ts
/**
* Pure + Effect helpers for listing initiatives (the engine half of the pi
* `/initiatives` command). The interactive pi handler lives in the extension.
*/
var initiatives_exports = /* @__PURE__ */ __exportAll({
	filterInitiatives: () => filterInitiatives,
	formatInitiativeList: () => formatInitiativeList,
	loadInitiativeListItems: () => loadInitiativeListItems,
	parseInitiativeFilter: () => parseInitiativeFilter
});
function filterInitiatives(items, filter) {
	if (filter === "all") return items;
	return items.filter((i) => i.status === filter);
}
const STATUS_ICON = {
	"in-progress": "🔵",
	done: "✅",
	superseded: "🔄",
	abandoned: "❌"
};
function formatInitiativeList(items, filter) {
	if (items.length === 0) return filter === "all" ? "No initiatives found in .plans/initiatives.jsonl" : `No initiatives with status "${filter}"`;
	return `${filter === "all" ? `All initiatives (${items.length})` : `Initiatives: ${filter} (${items.length})`}\n${items.map((i) => {
		const icon = STATUS_ICON[i.status];
		const progress = i.totalPlans > 0 ? ` [${i.donePlans}/${i.totalPlans} plans, ready ${i.ready}, blocked ${i.blocked}]` : " [no plans]";
		const date = i.created_at.slice(0, 10);
		return `  ${icon} ${i.name} — ${i.title}${progress}  (${date})`;
	}).join("\n")}`;
}
function loadInitiativeListItems() {
	return Effect.gen(function* () {
		const initiatives = yield* Effect.orElseSucceed(readInitiativesManifest(), () => []);
		const plans = yield* Effect.orElseSucceed(readPlansManifest(), () => []);
		return initiatives.map((entry) => {
			const r = initiativeRollup(entry.name, plans);
			return {
				name: entry.name,
				title: entry.title,
				status: entry.status,
				created_at: entry.created_at,
				totalPlans: r.total,
				donePlans: r.done,
				ready: r.ready,
				blocked: r.blocked
			};
		});
	});
}
const FILTER_ALIASES = {
	all: "all",
	"in-progress": "in-progress",
	active: "in-progress",
	done: "done",
	completed: "done",
	superseded: "superseded",
	abandoned: "abandoned"
};
function parseInitiativeFilter(raw) {
	for (const token of raw.toLowerCase().split(/\s+/)) if (FILTER_ALIASES[token]) return FILTER_ALIASES[token];
	return "all";
}
//#endregion
export { nodeFileSystemService as $, reactivateForExecution as A, reconcilePlanStatus as B, isInitiativeFinalizable as C, TasksFileNotFound as Ct, activeTasksResolved as D, reconcileInitiativeStatus as E, toNativeError as Et, writeInitiativesManifest as F, saveInitiative as G, writePlansManifest as H, applyPlanUpsert as I, writeTasksJsonl as J, readTasksJsonl as K, isTerminalStatus$1 as L, mutateInitiativesManifest as M, readInitiativesManifest as N, deferredTasks as O, upsertInitiativeEntry as P, FileSystem as Q, mutatePlansManifest as R, initiativeRollup as S, TaskNotFound as St, reconcileInitiativeForPlan as T, errorMessage as Tt, loadHandoff as U, upsertPlanEntry as V, saveHandoff as W, makePlanRuntime as X, withFileLock as Y, makeRuntimeLayer as Z, applyInitiativeReconcile as _, JsonlParseError as _t, filterPlans as a, PlanStatusSchema as at, collectPlanDrift as b, PlanReadError as bt, plans_exports as c, TaskRecordSchema as ct, setTaskStatus as d, decodeExecPendingConfig as dt, writeFileAtomic as et, nextTaskId as f, decodeInitiativeManifestEntry as ft, resolvePlanByName as g, decodeTasksLine as gt, normalizePlanName as h, decodeTaskRecord as ht, loadInitiativeListItems as i, PlanManifestEntrySchema as it, applyInitiativeUpsert as j, isPlanFinalizable as k, sortPlans as l, TaskStatusSchema as lt, loadPlanData as m, decodeTaskMeta as mt, formatInitiativeList as n, InitiativeManifestEntrySchema as nt, formatPlanList as o, TaskMetaSchema as ot, toKebabCase as p, decodePlanManifestEntry as pt, updateTask as q, initiatives_exports as r, InitiativeStatusSchema as rt, loadPlanListItems as s, TaskOriginSchema as st, filterInitiatives as t, ExecPendingConfigSchema as tt, appendDeferredTask as u, TasksLineSchema as ut, applyReconcile as v, JsonlValidationError as vt, membersOf as w, causeMessage as wt, computePlanReadiness as x, PlanWriteError as xt, collectInitiativeDrift as y, MissingMetaRecord as yt, readPlansManifest as z };

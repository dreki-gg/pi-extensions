/**
 * @dreki-gg/taskman — the plan-mode task-management engine.
 *
 * A standalone, pi-independent library over a `.plans/` JSONL ledger: plan +
 * initiative registries, task snapshots, status projection/reconcile, and the
 * stateless resolution + composite write flows that the pi extension and the
 * `taskman` CLI both build on.
 */

// Types + errors
export type {
  TaskStatus,
  TaskOrigin,
  PlanStatus,
  InitiativeStatus,
  TaskRecord,
  TaskMeta,
  PlanData,
  ExecPendingConfig,
  ThinkingLevel,
} from './types.js';
export * from './errors.js';

// Schema
export * from './schema.js';

// Effect runtime / filesystem seam
export {
  FileSystem,
  makeNodeFileSystemService,
  nodeFileSystemService,
  type FileSystemService,
} from './effects/filesystem.js';
export { makeRuntimeLayer, makePlanRuntime, type RunPlanIO } from './effects/runtime.js';

// Storage
export * from './storage/task-storage.js';
export * from './storage/plan-storage.js';
export {
  readPlansManifest,
  writePlansManifest,
  applyPlanUpsert,
  mutatePlansManifest,
  upsertPlanEntry,
  reconcilePlanStatus,
  isTerminalStatus,
  type PlanManifestEntry,
  type PlanUpsert,
} from './storage/plans-manifest.js';
export {
  readInitiativesManifest,
  writeInitiativesManifest,
  applyInitiativeUpsert,
  mutateInitiativesManifest,
  upsertInitiativeEntry,
  type InitiativeManifestEntry,
  type InitiativeUpsert,
} from './storage/initiatives-manifest.js';
export { writeFileAtomic } from './storage/atomic-write.js';
export { withFileLock } from './storage/file-lock.js';

// Status projection + reconcile + initiative logic
export * from './task-status.js';
export * from './reconcile.js';
export * from './initiative.js';

// Resolution + composite engine ops
export * from './resolve.js';
export * from './engine.js';

// Listing helpers
export * as PlanListing from './listing/plans.js';
export * as InitiativeListing from './listing/initiatives.js';

// Ids / name helpers
export { nextTaskId, toKebabCase } from './ids.js';

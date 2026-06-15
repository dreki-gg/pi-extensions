/**
 * Shared types for plan mode.
 */

export type TaskStatus = 'pending' | 'done' | 'skipped' | 'blocked' | 'deferred';

/** Where a task came from: the original submitted plan, or discovered during execution. */
export type TaskOrigin = 'plan' | 'discovered';

/**
 * Plan lifecycle status. Only `in-progress` is active; `done`, `superseded`,
 * and `abandoned` are terminal and drop out of active-plan resolution.
 */
export type PlanStatus = 'in-progress' | 'done' | 'superseded' | 'abandoned';

/** Initiative lifecycle reuses the plan lifecycle literals. */
export type InitiativeStatus = PlanStatus;

export interface TaskRecord {
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

export interface TaskMeta {
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

export interface PlanData {
  title: string;
  planName: string;
  handoff: string;
  tasks: TaskRecord[];
  /** Git commit the plan was written against; powers the executor drift check. */
  base_commit?: string;
}

export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export interface ExecPendingConfig {
  model: { provider: string; id: string };
  thinking: string;
}

export interface PersistedState {
  planEnabled: boolean;
  executing: boolean;
  planDir: string | undefined;
  plan: PlanData | undefined;
  executionStartIdx: number | undefined;
}

// Record validation lives in `schema.ts` (Effect Schema). The interfaces above
// remain the mutable shapes used by the imperative orchestration code.

/**
 * Shared types for plan mode.
 */

export type TaskStatus = 'pending' | 'done' | 'skipped' | 'blocked';

export interface TaskRecord {
  _type: 'task';
  id: string;
  description: string;
  details: string;
  status: TaskStatus;
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
}

export interface PlanData {
  title: string;
  planName: string;
  handoff: string;
  tasks: TaskRecord[];
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

const TASK_STATUSES = new Set<TaskStatus>(['pending', 'done', 'skipped', 'blocked']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isTaskRecord(value: unknown): value is TaskRecord {
  if (!isRecord(value)) return false;

  return (
    value._type === 'task' &&
    typeof value.id === 'string' &&
    typeof value.description === 'string' &&
    typeof value.details === 'string' &&
    typeof value.status === 'string' &&
    TASK_STATUSES.has(value.status as TaskStatus) &&
    (value.depends_on === undefined || isStringArray(value.depends_on)) &&
    (value.notes === undefined || typeof value.notes === 'string') &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string'
  );
}

export function isTaskMeta(value: unknown): value is TaskMeta {
  if (!isRecord(value)) return false;

  return (
    value._type === 'meta' &&
    typeof value.title === 'string' &&
    typeof value.plan_name === 'string' &&
    typeof value.created_at === 'string'
  );
}

/**
 * Shared types for plan mode.
 */

export interface PlanStep {
  description: string;
  details: string;
  status: 'pending' | 'done' | 'skipped' | 'blocked';
  notes?: string;
}

export interface PlanData {
  title: string;
  context: string;
  steps: PlanStep[];
  risks: string;
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

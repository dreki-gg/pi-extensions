/**
 * Encapsulates all mutable plan-mode state with persistence helpers.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { PlanData, PersistedState, ThinkingLevel } from './types.js';

export class PlanModeState {
  planEnabled = false;
  executing = false;
  planDir: string | undefined;
  plan: PlanData | undefined;
  executionStartIdx: number | undefined;
  previousThinking: ThinkingLevel | undefined;
  previousModel: { provider: string; id: string } | undefined;

  persist(pi: ExtensionAPI): void {
    pi.appendEntry<PersistedState>('plan-mode', {
      planEnabled: this.planEnabled,
      executing: this.executing,
      planDir: this.planDir,
      plan: this.plan,
      executionStartIdx: this.executionStartIdx,
    });
  }

  restore(entries: Array<{ type: string; customType?: string; data?: PersistedState }>): void {
    const saved = entries.filter((e) => e.type === 'custom' && e.customType === 'plan-mode').pop();
    if (saved?.data) {
      this.planEnabled = saved.data.planEnabled ?? this.planEnabled;
      this.executing = saved.data.executing ?? this.executing;
      this.planDir = saved.data.planDir ?? this.planDir;
      this.plan = saved.data.plan ?? this.plan;
      this.executionStartIdx = saved.data.executionStartIdx ?? this.executionStartIdx;
    }
  }

  reset(): void {
    this.planEnabled = false;
    this.executing = false;
    this.planDir = undefined;
    this.plan = undefined;
    this.executionStartIdx = undefined;
  }

  /** Exit plan/execution mode but keep plan data for update_task tracking. */
  exitPreservingPlan(): void {
    this.planEnabled = false;
    this.executing = false;
    this.executionStartIdx = undefined;
  }
}

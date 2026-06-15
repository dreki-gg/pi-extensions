/**
 * Plan-mode types.
 *
 * Engine record/value types now live in `@dreki-gg/taskman` and are re-exported
 * here so the rest of the extension keeps importing from `./types.js`. The
 * pi-session-only types (`PersistedState`) stay local.
 */

export type {
  TaskStatus,
  TaskOrigin,
  PlanStatus,
  InitiativeStatus,
  TaskRecord,
  TaskMeta,
  PlanData,
  ThinkingLevel,
  ExecPendingConfig,
} from '@dreki-gg/taskman';

import type { PlanData } from '@dreki-gg/taskman';

export interface PersistedState {
  planEnabled: boolean;
  executing: boolean;
  planDir: string | undefined;
  plan: PlanData | undefined;
  executionStartIdx: number | undefined;
}

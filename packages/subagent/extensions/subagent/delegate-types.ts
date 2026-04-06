import type { Message } from '@mariozechner/pi-ai';

export interface UsageStats {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  contextTokens: number;
  turns: number;
}

export interface AgentResult {
  agent: string;
  task: string;
  exitCode: number;
  messages: Message[];
  stderr: string;
  usage: UsageStats;
  model?: string;
  stopReason?: string;
  errorMessage?: string;
}

export type WorkflowId =
  | 'scout-only'
  | 'scout-and-plan'
  | 'implement'
  | 'implement-and-review'
  | 'quick-fix'
  | 'review';

export interface WorkflowDefinition {
  id: WorkflowId;
  label: string;
  description: string;
  phases: PhaseDefinition[];
}

export type PhaseKind = 'parallel' | 'single';

export interface PhaseDefinition {
  kind: PhaseKind;
  name: string;
  agents: string[];
  requiresConfirmation?: boolean;
  taskTemplate: string;
}

export interface PhaseResult {
  name: string;
  kind: PhaseKind;
  agents: AgentResult[];
  skipped?: boolean;
}

export interface DelegateState {
  synthesis: string;
  workflow: WorkflowDefinition;
  phases: PhaseResult[];
  totalUsage: UsageStats;
}

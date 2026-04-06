import type { WorkflowDefinition, WorkflowId } from './delegate-types';

export const WORKFLOWS: WorkflowDefinition[] = [
  {
    id: 'scout-only',
    label: 'Scout only',
    description: 'Parallel scouts for exploration — no plan, no implementation',
    phases: [
      {
        kind: 'parallel',
        name: 'Scouts',
        agents: ['scout', 'docs-scout'],
        taskTemplate: '{synthesis}',
      },
    ],
  },
  {
    id: 'scout-and-plan',
    label: 'Scout and plan',
    description: 'Parallel scouts → planner — produces a plan without implementing',
    phases: [
      {
        kind: 'parallel',
        name: 'Scouts',
        agents: ['scout', 'docs-scout'],
        taskTemplate: '{synthesis}',
      },
      {
        kind: 'single',
        name: 'Planner',
        agents: ['planner'],
        taskTemplate:
          'Create an implementation plan based on the following context.\n\n## Task\n{synthesis}\n\n## Scout findings\n{previous}',
      },
    ],
  },
  {
    id: 'implement',
    label: 'Implement',
    description: 'Parallel scouts → planner → worker — full implementation',
    phases: [
      {
        kind: 'parallel',
        name: 'Scouts',
        agents: ['scout', 'docs-scout'],
        taskTemplate: '{synthesis}',
      },
      {
        kind: 'single',
        name: 'Planner',
        agents: ['planner'],
        requiresConfirmation: true,
        taskTemplate:
          'Create an implementation plan based on the following context.\n\n## Task\n{synthesis}\n\n## Scout findings\n{previous}',
      },
      {
        kind: 'single',
        name: 'Worker',
        agents: ['worker'],
        taskTemplate:
          'Implement the following plan.\n\n## Task\n{synthesis}\n\n## Plan\n{previous}',
      },
    ],
  },
  {
    id: 'implement-and-review',
    label: 'Implement and review',
    description:
      'Parallel scouts → planner → worker → reviewer — full implementation with code review',
    phases: [
      {
        kind: 'parallel',
        name: 'Scouts',
        agents: ['scout', 'docs-scout'],
        taskTemplate: '{synthesis}',
      },
      {
        kind: 'single',
        name: 'Planner',
        agents: ['planner'],
        requiresConfirmation: true,
        taskTemplate:
          'Create an implementation plan based on the following context.\n\n## Task\n{synthesis}\n\n## Scout findings\n{previous}',
      },
      {
        kind: 'single',
        name: 'Worker',
        agents: ['worker'],
        taskTemplate:
          'Implement the following plan.\n\n## Task\n{synthesis}\n\n## Plan\n{previous}',
      },
      {
        kind: 'single',
        name: 'Reviewer',
        agents: ['reviewer'],
        taskTemplate:
          'Review the implementation described below.\n\n## Task\n{synthesis}\n\n## Implementation output\n{previous}',
      },
    ],
  },
  {
    id: 'quick-fix',
    label: 'Quick fix',
    description: 'Worker only — fast, no scouts or planning',
    phases: [
      {
        kind: 'single',
        name: 'Worker',
        agents: ['worker'],
        taskTemplate: '{synthesis}',
      },
    ],
  },
  {
    id: 'review',
    label: 'Review',
    description: 'Reviewer only — code review of recent changes',
    phases: [
      {
        kind: 'single',
        name: 'Reviewer',
        agents: ['reviewer'],
        taskTemplate: '{synthesis}',
      },
    ],
  },
];

export function getWorkflow(id: WorkflowId): WorkflowDefinition {
  const wf = WORKFLOWS.find((w) => w.id === id);
  if (!wf) throw new Error(`Unknown workflow: ${id}`);
  return wf;
}

export function suggestWorkflow(synthesis: string): WorkflowId {
  const lower = synthesis.toLowerCase();

  const hasReview = /review|audit|check quality|security/.test(lower);
  const hasFix = /fix|bug|patch|hotfix|quick/.test(lower);
  const hasImplement = /implement|build|create|add|refactor|migrate/.test(lower);
  const hasDesign = /design|plan|architect|explore|investigate|scout/.test(lower);

  if (hasFix && !hasImplement && !hasDesign) return 'quick-fix';
  if (hasReview && !hasImplement && !hasDesign) return 'review';
  if (hasDesign && !hasImplement) return 'scout-and-plan';
  if (hasImplement && hasReview) return 'implement-and-review';
  if (hasImplement) return 'implement';

  return 'implement';
}

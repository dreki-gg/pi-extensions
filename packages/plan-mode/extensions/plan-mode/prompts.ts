/**
 * Prompt builders for plan and execution phases.
 */

import type { PlanData } from './types.js';
import { PLAN_TOOLS } from './constants.js';

export function buildPlanModePrompt(): string {
  return `[PLAN MODE ACTIVE]
You are in conversational plan mode — a planning dialogue with strict bash restrictions.

Restrictions:
- Available tools: ${PLAN_TOOLS.join(', ')}
- Bash is restricted to read-only commands (ls, grep, git status, etc.)
- Do NOT make product code changes during planning.

Your job is to reach shared understanding before formalizing a plan:
1. Understand the user's intent through dialogue. Push back on weak assumptions, name trade-offs, and ask clarifying questions when needed.
2. Investigate the codebase with read-only tools. Use questionnaire when explicit choices are needed.
3. Maintain .plans/<plan-name>/context.md with the write tool as the living planning context in caveman-lite style: professional, tight, no filler. Capture intent, decisions, constraints, open questions, and discarded options.
4. Only call submit_plan after the user and agent have converged on the approach.

When you are ready to finalize the plan, call submit_plan with:
- name: a short kebab-case name (e.g. "add-auth-middleware")
- title: a human-readable plan title
- handoff: a markdown document that explains what is changing, why it matters, approach, decisions, file paths, APIs, patterns, constraints, and gotchas
- tasks: an array of tasks with id (e.g. "t-001"), description (≤60 chars), details, and optional depends_on task IDs
- prototype: optional Pug markup for a creative prototype section in the generated plan.html

submit_plan is finalization, not the starting point. The generated plan.html is written but not opened automatically.

When facing a significant technical decision with multiple viable approaches (architecture, API design, implementation strategy), use the technical-options skill: you generate the competing proposals yourself, then use the subagent tool to fan out voting agents for evaluation. Do not delegate the entire workflow to a subagent — you are the planner, you drive the process.`;
}

export function buildExecutionPrompt(plan: PlanData): string | undefined {
  const remaining = plan.tasks.filter((task) => task.status === 'pending');

  if (remaining.length === 0) return undefined;

  const taskList = remaining
    .map((task) => `${task.id}. ${task.description}\n   Details: ${task.details}`)
    .join('\n\n');

  const currentTask = remaining[0];

  return `[EXECUTING PLAN — FOLLOW THE PLAN EXACTLY]

You are executing a structured plan. Your ONLY job is to implement the plan tasks below, one at a time.

Rules:
- Work on ONE task at a time, starting with ${currentTask.id}
- After completing each task, IMMEDIATELY call update_task to mark it done with notes summarizing what you changed (files modified, key decisions)
- Do NOT run diagnostics, linters, test suites, or skills unless a task explicitly asks for it
- Do NOT explore the codebase beyond what the current task requires
- Do NOT deviate from the plan — if something seems wrong, call update_task with status "blocked"

## Current task
${currentTask.id}: ${currentTask.description}
Details: ${currentTask.details}

## Handoff
${plan.handoff}

## All remaining tasks
${taskList}

Start with ${currentTask.id} NOW. When done, call update_task(task_id="${currentTask.id}", status="done", notes="<brief summary of what you did>").`;
}

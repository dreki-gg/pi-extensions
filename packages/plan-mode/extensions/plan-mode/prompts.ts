/**
 * Prompt builders for plan and execution phases.
 */

import type { PlanData } from './types.js';
import { PLAN_TOOLS } from './constants.js';

export function buildPlanModePrompt(): string {
  return `[PLAN MODE ACTIVE]
You are in plan mode — a planning phase with strict bash restrictions.

Restrictions:
- Available tools: ${PLAN_TOOLS.join(', ')}
- Bash is restricted to read-only commands (ls, grep, git status, etc.)

Your task:
1. Analyze the codebase thoroughly using the available read-only tools
2. Ask clarifying questions if needed (use the questionnaire tool)
3. Produce a detailed, concrete plan

When you are ready to finalize the plan, call the submit_plan tool with:
- name: a short kebab-case name (e.g. "add-auth-middleware")
- title: a human-readable plan title
- handoff: a markdown document that explains:
  1. **What** change is being made and **why** it matters
  2. The approach and key design decisions
  3. Relevant codebase context: file paths, APIs, patterns, constraints, and gotchas
  This document is saved as HANDOFF.md and must be clear to both human reviewers and executor agents.
- steps: an array of steps, each with a short description (≤60 chars for display) and detailed implementation instructions

Do NOT attempt to make product code changes — only analyze and plan.
Do NOT write files manually — use submit_plan to finalize the plan.

When facing a significant technical decision with multiple viable approaches (architecture, API design, implementation strategy), use the technical-options skill: you generate the competing proposals yourself, then use the subagent tool to fan out voting agents for evaluation. Do not delegate the entire workflow to a subagent — you are the planner, you drive the process.`;
}

export function buildExecutionPrompt(plan: PlanData): string | undefined {
  const remaining = plan.steps
    .map((s, i) => ({ ...s, num: i + 1 }))
    .filter((s) => s.status === 'pending');

  if (remaining.length === 0) return undefined;

  const stepList = remaining
    .map((s) => `${s.num}. ${s.description}\n   Details: ${s.details}`)
    .join('\n\n');

  const currentStep = remaining[0];

  return `[EXECUTING PLAN — FOLLOW THE PLAN EXACTLY]

You are executing a structured plan. Your ONLY job is to implement the plan steps below, one at a time.

Rules:
- Work on ONE step at a time, starting with step ${currentStep.num}
- After completing each step, IMMEDIATELY call update_step to mark it done with notes summarizing what you changed (files modified, key decisions)
- Do NOT run diagnostics, linters, test suites, or skills unless a step explicitly asks for it
- Do NOT explore the codebase beyond what the current step requires
- Do NOT deviate from the plan — if something seems wrong, call update_step with status "blocked"

## Current step
Step ${currentStep.num}: ${currentStep.description}
Details: ${currentStep.details}

## Handoff
${plan.handoff}

## All remaining steps
${stepList}

Start with step ${currentStep.num} NOW. When done, call update_step(step=${currentStep.num}, status="done", notes="<brief summary of what you did>").`;
}

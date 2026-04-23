---
name: "Structured handoffs + synthesis for chain workflows"
overview: "Introduce a first-class handoff format for `@dreki-gg/pi-subagent` so chained agents pass compact, decision-rich context instead of raw `{previous}` markdown blobs. This slice should improve coherence across isolated agents without changing the core single/parallel/chain execution model."
todo:
  - id: "structured-handoffs-1"
    task: "Add a handoff module that normalizes agent output into a compact envelope with goal, decisions, constraints, files, symbols, and raw output"
    status: pending
  - id: "structured-handoffs-2"
    task: "Thread the structured handoff through chain execution in `extensions/subagent/index.ts` while preserving `{previous}` compatibility"
    status: pending
  - id: "structured-handoffs-3"
    task: "Tighten bundled prompts so scout/planner/worker/docs-scout emit sections the handoff module can reliably summarize"
    status: pending
---

# Goal

Make chained subagent workflows in `packages/subagent` pass structured, compact handoffs instead of blindly injecting the previous agent’s final markdown blob into the next task.

# Context

- Parent rationale: apply the “single writer, many thinkers” / “context engineering over prompt gimmicks” learnings we discussed for `@dreki-gg/pi-subagent`.
- Module root: `packages/subagent`
- This slice is infrastructure. Later slices like clean-context review, manager orchestration, and advisor routing should be able to reuse the same handoff format, but this plan must **not** assume those slices already exist.
- Existing repo convention for package-local planning docs lives under `packages/<pkg>/docs/plans/` (see `packages/browser-tools/docs/plans/`).

## What exists

Current relevant file tree on disk:

- `packages/subagent/package.json`
- `packages/subagent/tsconfig.json`
- `packages/subagent/README.md`
- `packages/subagent/CHANGELOG.md`
- `packages/subagent/extensions/subagent/index.ts`
- `packages/subagent/extensions/subagent/agents.ts`
- `packages/subagent/extensions/subagent/agent-runner.ts`
- `packages/subagent/extensions/subagent/agent-runner-types.ts`
- `packages/subagent/extensions/subagent/agent-result-utils.ts`
- `packages/subagent/extensions/subagent/run-agent-args.ts`
- `packages/subagent/extensions/subagent/synthesis.ts`
- `packages/subagent/agents/docs-scout.md`
- `packages/subagent/agents/planner.md`
- `packages/subagent/agents/reviewer.md`
- `packages/subagent/agents/scout.md`
- `packages/subagent/agents/ux-designer.md`
- `packages/subagent/agents/worker.md`
- `packages/subagent/prompts/implement.md`
- `packages/subagent/prompts/implement-and-review.md`
- `packages/subagent/prompts/scout-and-plan.md`
- `packages/subagent/skills/spawn-subagents/SKILL.md`
- `packages/subagent/skills/write-an-agent/SKILL.md`

Actual current behavior on disk:

- Chain mode is still raw text plumbing. In `packages/subagent/extensions/subagent/index.ts:658-716`, each step computes `taskWithContext = step.task.replace(/\{previous\}/g, previousOutput)` and then updates `previousOutput = getFinalOutput(result.messages)`. There is no typed handoff object, parser, or summarizer.
- `getFinalOutput()` in `packages/subagent/extensions/subagent/index.ts:204-214` returns only the last assistant text block, so any rich structure from tool calls or earlier assistant messages is discarded before handoff.
- `run-agent` synthesizes main-conversation context via `extractRecentConversation()` and `buildRunAgentTask()` (`index.ts:1215-1229`, `index.ts:1557-1559`), but that synthesis is only used for direct `/run-agent` entry and not for agent-to-agent handoff.
- `packages/subagent/extensions/subagent/synthesis.ts:5-38` already defines a strong section-oriented synthesis instruction (`Goal`, `Decisions`, `Constraints`, `Architecture`, `Open Questions`, `Intent`), but those sections are not reused anywhere in chain orchestration.
- Bundled prompt templates still explicitly rely on `{previous}` text substitution:
  - `packages/subagent/prompts/implement.md:6-10`
  - `packages/subagent/prompts/scout-and-plan.md:6-9`
  - `packages/subagent/prompts/implement-and-review.md:6-10`
- The `spawn-subagents` skill already hints at the desired future shape: it says to “return a compact synthesis to the main thread” and to pass previous outputs “verbatim or as a tight structured summary” (`packages/subagent/skills/spawn-subagents/SKILL.md:31-35`, `:49-54`). That guidance is not enforced in code.
- Bundled agents already emit semi-structured markdown, but the section names are inconsistent across roles:
  - `scout` => `Files Retrieved`, `Key Code`, `Architecture`, `Start Here`
  - `docs-scout` => `Libraries`, `Key Documentation`, `Integration Notes`, `Recommended Next Step`
  - `planner` => `Goal`, `Plan`, `Files to Modify`, `New Files`, `Risks`
  - `worker` => `Completed`, `Files Changed`, `Notes`
- There is no test directory in `packages/subagent`; current validation is package typechecking (`packages/subagent/package.json`, `packages/subagent/tsconfig.json`).

# API inventory

## Existing public types and helpers the implementation will touch

From `packages/subagent/extensions/subagent/agents.ts`:

```ts
export type AgentScope = 'user' | 'project' | 'both';
export type AgentSource = 'bundled' | 'user' | 'project' | 'package';
export type AgentSessionStrategy = 'inline' | 'fork-at';

export interface AgentConfig {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  thinking?: string;
  sessionStrategy?: AgentSessionStrategy;
  systemPrompt: string;
  source: AgentSource;
  filePath: string;
}

export interface AgentDiscoveryResult {
  agents: AgentConfig[];
  projectAgentsDir: string | null;
}
```

From `packages/subagent/extensions/subagent/agent-runner-types.ts`:

```ts
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
```

From `packages/subagent/extensions/subagent/agent-runner.ts`:

```ts
export type OnPhaseUpdate = (
  phaseName: string,
  agentName: string,
  result: AgentResult,
) => void;

export interface RunAgentOptions {
  agentScope?: AgentScope;
  cwd?: string;
  onUpdate?: OnPhaseUpdate;
  phaseName?: string;
  signal?: AbortSignal;
  resolvedPaths?: ResolvedPaths;
}

export async function runAgent(
  cwd: string,
  agentName: string,
  task: string,
  options: RunAgentOptions = {},
): Promise<AgentResult>
```

From `packages/subagent/extensions/subagent/synthesis.ts`:

```ts
export function extractRecentConversation(
  ctx: ExtensionCommandContext,
): string

export function buildSynthesisPrompt(
  conversation: string,
  explicitTask?: string,
): string
```

## Existing internal chain data shape in `index.ts`

```ts
interface SingleResult {
  agent: string;
  agentSource: AgentSource | 'unknown';
  task: string;
  exitCode: number;
  messages: Message[];
  stderr: string;
  usage: UsageStats;
  model?: string;
  stopReason?: string;
  errorMessage?: string;
  step?: number;
}

interface SubagentDetails {
  mode: 'single' | 'parallel' | 'chain';
  agentScope: AgentScope;
  projectAgentsDir: string | null;
  results: SingleResult[];
}
```

These are currently private to `index.ts`, but the new handoff helper can either:
- accept a narrow `Pick<SingleResult, ...>` shape, or
- define its own exported `HandoffSource` input type to avoid importing internal UI state.

## Proposed new handoff shape for this slice

Create a dedicated module for this instead of baking ad hoc string munging into `index.ts`:

```ts
export interface HandoffFileRef {
  path: string;
  notes?: string;
}

export interface HandoffEnvelope {
  version: 'subagent-handoff/v1';
  sourceAgent: string;
  sourceStep?: number;
  task: string;
  summary: string;
  goal?: string;
  decisions: string[];
  constraints: string[];
  files: HandoffFileRef[];
  symbols: string[];
  openQuestions: string[];
  rawOutput: string;
}

export interface RenderHandoffOptions {
  includeRawOutput?: boolean;
  maxRawChars?: number;
}

export function buildHandoffFromResult(input: {
  agent: string;
  step?: number;
  task: string;
  output: string;
}): HandoffEnvelope

export function renderHandoffForPrompt(
  handoff: HandoffEnvelope,
  options?: RenderHandoffOptions,
): string
```

The parser can be heuristic and markdown-based. It does **not** need to become a full AST parser. The goal is reliable compaction, not perfect semantic extraction.

# Tasks

## 1. Add a handoff module that normalizes agent output into a compact envelope

### Files
- Create `packages/subagent/extensions/subagent/handoffs.ts`

### What to add
- Export a small, typed handoff model (see `Proposed new handoff shape` above).
- Implement markdown-section extraction that recognizes the current bundled agent contracts:
  - `## Goal`
  - `## Decisions`
  - `## Constraints`
  - `## Architecture`
  - `## Open Questions`
  - `## Plan`
  - `## Files Retrieved`
  - `## Files to Modify`
  - `## New Files`
  - `## Files Changed`
  - `## Notes`
  - `## Risks`
  - `## Recommended Next Step`
- Build a compact summary by prioritizing the most useful sections instead of returning the entire raw output.
- Extract file paths by scanning markdown bullets/code spans for repo-looking paths (e.g. `` `packages/subagent/...` ``).
- Extract symbols conservatively from code fences or bullets when they are clearly named functions/types; do not overfit.
- Always keep `rawOutput` so callers can still include the source text when needed.

### Code sketch

```ts
const SECTION_RE = /^##\s+(.+)$/gm;

function splitMarkdownSections(markdown: string): Map<string, string> {
  // return section title -> body
}

export function buildHandoffFromResult(input: {
  agent: string;
  step?: number;
  task: string;
  output: string;
}): HandoffEnvelope {
  const sections = splitMarkdownSections(input.output);
  return {
    version: 'subagent-handoff/v1',
    sourceAgent: input.agent,
    sourceStep: input.step,
    task: input.task,
    summary: ..., 
    goal: ..., 
    decisions: ..., 
    constraints: ..., 
    files: ..., 
    symbols: ..., 
    openQuestions: ..., 
    rawOutput: input.output,
  };
}
```

### Notes
- Keep this module dependency-free.
- Do not move UI rendering logic into this file.
- The formatter should emit readable markdown because existing prompt templates still use string substitution.

## 2. Thread the structured handoff through chain execution in `extensions/subagent/index.ts`

### Files
- Modify `packages/subagent/extensions/subagent/index.ts`

### What to change
- Import the new handoff helper.
- In the chain path (`index.ts:658-716`), replace the raw `previousOutput` update with a rendered handoff string built from the prior step’s final output.
- Preserve the existing `{previous}` placeholder contract so current prompt templates still work, but change what gets injected:
  - before: raw final assistant text
  - after: a compact structured markdown summary plus optional truncated raw output
- Keep error handling behavior unchanged.
- Keep streaming UI behavior unchanged.

### Implementation rules
- Do **not** change single-mode or parallel-mode semantics in this slice.
- Do **not** add a new tool mode; keep `single`, `parallel`, and `chain` only.
- Avoid coupling the handoff module to `Message[]`; extract final text in `index.ts` and pass plain strings into the helper.
- If the previous step returned no final text, fall back to `'(no output)'` exactly as current code does.

## 3. Tighten bundled prompts so handoffs have stable sections to summarize

### Files
- Modify `packages/subagent/agents/scout.md`
- Modify `packages/subagent/agents/docs-scout.md`
- Modify `packages/subagent/agents/planner.md`
- Modify `packages/subagent/agents/worker.md`
- Modify `packages/subagent/prompts/implement.md`
- Modify `packages/subagent/prompts/scout-and-plan.md`

### What to change
- Keep the roles the same, but make their output contracts easier to summarize reliably.
- Prefer stable section names over freeform prose.
- Add a small “Handoff” / “Next step” section where helpful instead of forcing the summarizer to infer everything from generic notes.

### Recommended section adjustments
- `scout.md`: keep `Files Retrieved` / `Key Code` / `Architecture`, and add `## Constraints or Unknowns`
- `docs-scout.md`: keep `Libraries` / `Key Documentation` / `Integration Notes`, and make `Recommended Next Step` mandatory
- `planner.md`: keep `Goal` / `Plan` / `Files to Modify` / `New Files` / `Risks`; optionally add `## Constraints`
- `worker.md`: keep `Completed` / `Files Changed` / `Notes`, but require a short bullet list of decisions made and unresolved concerns
- Prompt templates should mention that `{previous}` now contains a structured handoff, not an unbounded transcript dump

# Files to create

- `packages/subagent/extensions/subagent/handoffs.ts`

# Files to modify

- `packages/subagent/extensions/subagent/index.ts` — switch chain substitution from raw final text to rendered structured handoff
- `packages/subagent/agents/scout.md` — make scout output easier to summarize deterministically
- `packages/subagent/agents/docs-scout.md` — make docs handoff more consistent
- `packages/subagent/agents/planner.md` — preserve plan structure but expose constraints explicitly
- `packages/subagent/agents/worker.md` — add explicit decision / unresolved sections for downstream agents
- `packages/subagent/prompts/implement.md` — document structured `{previous}` expectations
- `packages/subagent/prompts/scout-and-plan.md` — document structured `{previous}` expectations

# Testing notes

- Run `bun run --filter '@dreki-gg/pi-subagent' typecheck` after adding `handoffs.ts` and updating imports.
- Manually inspect the rendered handoff string by running a small local chain (for example, a trivial `scout -> planner` task) and confirm that the second step receives a compact summary instead of a huge raw blob.
- Verify that existing prompt templates still work without changing the user-facing `{previous}` placeholder name.
- Do not add runtime-only assumptions about sibling plans. This slice must provide value on its own.

# Patterns to follow

- `packages/subagent/extensions/subagent/synthesis.ts:5-38` — section-oriented synthesis prompt structure worth mirroring in handoffs
- `packages/subagent/extensions/subagent/index.ts:658-716` — existing chain control flow to preserve
- `packages/subagent/extensions/subagent/index.ts:204-214` — current final-output extraction behavior to wrap, not duplicate all over the package
- `packages/subagent/skills/spawn-subagents/SKILL.md:31-35` — “compact synthesis” guidance already present in the skill
- `packages/subagent/skills/spawn-subagents/SKILL.md:49-54` — existing advice about structured summaries
- `packages/subagent/skills/write-an-agent/SKILL.md:15-20` and `:62-67` — output contracts should stay sharp and structured

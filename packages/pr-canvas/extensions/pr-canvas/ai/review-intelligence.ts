import type { PrData } from '../github/types';
import { detectDataStructures, detectSurfaces, buildSourceReferences, describeFileRole, firstAddedRange, formatReference, hasSecretFallback } from './diff-analysis';
import { generateHeuristicMindMap } from './mind-map';
import type { AiSummary, MindMapGroup, ReviewIntelligence } from './types';

export type AiReviewFn = (message: string, context: string) => Promise<string>;

export async function generateReviewIntelligence(
  pr: PrData,
  rawDiff: string,
  aiReview?: AiReviewFn,
): Promise<ReviewIntelligence> {
  const fallback = (): ReviewIntelligence => ({
    summary: buildRichHeuristicSummary(pr),
    mindMap: generateHeuristicMindMap(pr),
  });

  if (!aiReview) return fallback();

  try {
    const response = await aiReview(buildReviewPrompt(pr), buildReviewContext(pr, rawDiff));
    const parsed = parseAiReview(response);
    if (!parsed) return fallback();
    return parsed;
  } catch {
    return fallback();
  }
}

export function buildRichHeuristicSummary(pr: PrData): AiSummary {
  const legacy = buildLegacySummary(pr);
  const endpoints = detectSurfaces(pr);
  const dataStructures = detectDataStructures(pr);
  const sourceReferences = buildSourceReferences(pr);
  const secretFallback = hasSecretFallback(pr);
  const majorFiles = pr.files
    .filter((file) => !/\b(test|tests|spec|__tests__)\b|\.(test|spec)\./.test(file.path))
    .slice(0, 6);

  const whatChanged = majorFiles.map((file) => {
    const ref = firstAddedRange(file);
    const source = ref ? formatReference(ref) : file.path;
    return `${changeVerb(file.status)} ${file.path} as ${describeFileRole(file)} (${source})`;
  });

  const systemFlow = buildSystemFlow(pr, endpoints, dataStructures);
  const hotSpots = buildHotSpots(pr, secretFallback);
  const openQuestions = buildOpenQuestions(pr, endpoints, dataStructures, secretFallback);
  const highlights = [...legacy.highlights];

  if (endpoints.length > 0) {
    highlights.unshift(
      `Callable surfaces: ${endpoints.map((surface) => `${surface.method} ${surface.path} (${surface.change})`).join(', ')}`,
    );
  }
  if (dataStructures.length > 0) {
    highlights.unshift(`Data structures: ${dataStructures.map((structure) => structure.name).join(', ')}`);
  }

  return {
    ...legacy,
    highlights,
    concerns: [...new Set([...legacy.concerns, ...hotSpots.filter((item) => /secret|auth|CI|fail|coverage/i.test(item))])],
    tldr: buildTldr(pr, endpoints, dataStructures),
    whatChanged,
    systemFlow,
    endpoints,
    dataStructures,
    hotSpots,
    openQuestions,
    sourceReferences,
    generatedBy: 'heuristic',
  };
}

function buildLegacySummary(pr: PrData): AiSummary {
  const purpose = derivePurpose(pr);
  return {
    purpose,
    impact: deriveImpact(pr),
    concerns: deriveConcerns(pr),
    highlights: deriveHighlights(pr),
    generatedBy: 'heuristic',
  };
}

function buildTldr(pr: PrData, endpoints: ReturnType<typeof detectSurfaces>, dataStructures: ReturnType<typeof detectDataStructures>): string {
  const noun = inferPrimarySystem(pr);
  const endpointPart = endpoints.length > 0
    ? ` It exposes or changes ${endpoints.length} callable surface${endpoints.length === 1 ? '' : 's'} (${endpoints.map((s) => `${s.method} ${s.path}`).join(', ')}).`
    : '';
  const dataPart = dataStructures.length > 0
    ? ` It also introduces ${dataStructures.map((s) => s.name).join(', ')} data shape${dataStructures.length === 1 ? '' : 's'}.`
    : '';
  const authKind = /jwt|jsonwebtoken|token/i.test(`${pr.overview.title}\n${pr.overview.body}\n${pr.files.map((file) => file.patch).join('\n')}`) ? ' JWT' : '';
  return `${pr.overview.title} centers on the${authKind} ${noun}, touching ${pr.files.length} files with +${pr.overview.additions}/-${pr.overview.deletions} lines.${endpointPart}${dataPart}`;
}

function inferPrimarySystem(pr: PrData): string {
  const text = `${pr.overview.title}\n${pr.overview.body}\n${pr.files.map((f) => f.path).join('\n')}`.toLowerCase();
  if (/auth|jwt|token|permission/.test(text)) return 'the authentication/control-flow boundary';
  if (/websocket|socket|bridge/.test(text)) return 'the WebSocket/event bridge';
  if (/route|api|endpoint|handler/.test(text)) return 'API routing';
  if (/schema|type|model|dto/.test(text)) return 'data contracts';
  return 'the changed subsystem';
}

function buildSystemFlow(pr: PrData, endpoints: ReturnType<typeof detectSurfaces>, dataStructures: ReturnType<typeof detectDataStructures>): string[] {
  const flow: string[] = [];
  if (endpoints.length > 0) {
    flow.push(`Caller enters ${endpoints.map((surface) => `${surface.method} ${surface.path}`).join(', ')}; changed routes now declare ${summarizeAuth(endpoints)}.`);
  }
  const middlewareFiles = pr.files.filter((file) => /middleware|auth|token/i.test(file.path));
  if (middlewareFiles.length > 0) {
    flow.push(`Middleware/utilities in ${middlewareFiles.map((file) => file.path).join(', ')} validate or derive request identity before downstream handlers run.`);
  }
  if (dataStructures.length > 0) {
    flow.push(`Typed contracts introduced here: ${dataStructures.map((structure) => structure.name).join(', ')}.`);
  }
  if (flow.length === 0) flow.push('Diff changes are grouped by file role; no explicit request/event flow was detectable from route or handler patterns.');
  return flow;
}

function summarizeAuth(endpoints: ReturnType<typeof detectSurfaces>): string {
  const auth = [...new Set(endpoints.map((surface) => surface.auth).filter(Boolean))];
  return auth.length > 0 ? auth.join(', ') : 'auth not visible in the diff';
}

function buildHotSpots(pr: PrData, secretFallback?: string): string[] {
  const hotSpots: string[] = [];
  if (secretFallback) hotSpots.push(`Security: verify fallback secret handling before merge (${secretFallback}).`);

  const failedChecks = pr.checks.filter((check) => check.state === 'FAILURE' || check.state === 'STARTUP_FAILURE');
  if (failedChecks.length > 0) hotSpots.push(`CI: ${failedChecks.map((check) => check.name).join(', ')} failing; confirm failures are unrelated or fixed.`);

  const hasSourceChanges = pr.files.some((file) => !/\b(test|tests|spec|__tests__)\b|\.(test|spec)\./.test(file.path) && /\.(ts|tsx|js|jsx)$/.test(file.path));
  const hasTests = pr.files.some((file) => /\b(test|tests|spec|__tests__)\b|\.(test|spec)\./.test(file.path));
  if (hasSourceChanges && !hasTests) hotSpots.push('Coverage: source files changed without test files in this PR.');

  const routeFiles = pr.files.filter((file) => /route|api|handler|controller/.test(file.path));
  for (const file of routeFiles) hotSpots.push(`Contract boundary: check changed route behavior and status codes in ${file.path}.`);

  if (hotSpots.length === 0) hotSpots.push('Review the largest changed files for edge cases and contract drift.');
  return hotSpots.slice(0, 6);
}

function buildOpenQuestions(
  _pr: PrData,
  endpoints: ReturnType<typeof detectSurfaces>,
  dataStructures: ReturnType<typeof detectDataStructures>,
  secretFallback?: string,
): string[] {
  const questions: string[] = [];
  if (secretFallback) questions.push('Should this PR fail fast when the secret is unset instead of using a fallback/default?');
  for (const endpoint of endpoints) {
    if (endpoint.auth === 'not visible in route signature') questions.push(`What auth model protects ${endpoint.method} ${endpoint.path}?`);
    if (endpoint.responseShape === 'not inferable from diff') questions.push(`What exact response contract should reviewers expect from ${endpoint.method} ${endpoint.path}?`);
  }
  for (const structure of dataStructures) {
    if (structure.fields.length === 0) questions.push(`What fields make up ${structure.name}, and are they serialized or internal-only?`);
  }
  return questions.length > 0 ? [...new Set(questions)].slice(0, 6) : ['None — the diff is self-contained.'];
}

function changeVerb(status: string): string {
  if (status === 'added') return 'Adds';
  if (status === 'deleted') return 'Removes';
  if (status === 'renamed') return 'Renames';
  return 'Changes';
}

function derivePurpose(pr: PrData): string {
  const { overview } = pr;
  if (overview.body) {
    const firstPara = overview.body
      .split('\n\n')
      .find((p) => p.trim() && !p.trim().startsWith('#') && !p.trim().startsWith('- '));
    if (firstPara && firstPara.trim().length > 10) return firstPara.trim().slice(0, 300);
  }
  return overview.title;
}

function deriveImpact(pr: PrData): string {
  const dirs = new Set(pr.files.map((f) => f.path.split('/')[0]));
  const parts: string[] = [];
  if (dirs.size > 0) parts.push(`Affects ${dirs.size} top-level ${dirs.size === 1 ? 'area' : 'areas'}: ${[...dirs].join(', ')}`);
  parts.push(`${pr.overview.additions} lines added, ${pr.overview.deletions} lines removed across ${pr.files.length} files`);
  return parts.join('. ') + '.';
}

function deriveConcerns(pr: PrData): string[] {
  const concerns: string[] = [];
  if (pr.files.length > 20) concerns.push(`Large PR with ${pr.files.length} files — consider splitting`);
  if (pr.overview.deletions > 500) concerns.push(`Significant deletions (${pr.overview.deletions} lines) — verify nothing is lost`);

  const hasTests = pr.files.some((f) => f.status !== 'deleted' && (/\.(test|spec)\.\w+$/.test(f.path) || /\b(test|tests|spec|__tests__)\b/.test(f.path)));
  const hasSourceChanges = pr.files.some((f) => f.status !== 'deleted' && !(/\.(test|spec)\.\w+$/.test(f.path)) && /\.(ts|js|tsx|jsx|py|rb|go|rs)$/.test(f.path));
  if (hasSourceChanges && !hasTests) concerns.push('No test files modified — consider adding test coverage');

  const failedChecks = pr.checks.filter((c) => c.state === 'FAILURE' || c.state === 'STARTUP_FAILURE');
  if (failedChecks.length > 0) concerns.push(`${failedChecks.length} CI check${failedChecks.length > 1 ? 's' : ''} failing: ${failedChecks.map((c) => c.name).join(', ')}`);
  return concerns;
}

function deriveHighlights(pr: PrData): string[] {
  const highlights: string[] = [];
  const newFiles = pr.files.filter((f) => f.status === 'added');
  if (newFiles.length > 0) highlights.push(newFiles.length <= 3 ? `New files: ${newFiles.map((f) => f.path).join(', ')}` : `${newFiles.length} new files added`);

  const deletedFiles = pr.files.filter((f) => f.status === 'deleted');
  if (deletedFiles.length > 0) highlights.push(deletedFiles.length <= 3 ? `Removed: ${deletedFiles.map((f) => f.path).join(', ')}` : `${deletedFiles.length} files removed`);

  const biggest = [...pr.files].sort((a, b) => (b.additions + b.deletions) - (a.additions + a.deletions))[0];
  if (biggest && biggest.additions + biggest.deletions > 50) highlights.push(`Most changed: ${biggest.path} (+${biggest.additions} −${biggest.deletions})`);
  return highlights;
}

function buildReviewPrompt(pr: PrData): string {
  return `You are PR Canvas architecture-review synthesis. Return strict JSON only with {"summary": AiSummary, "mindMap": MindMapGroup[]}.

Use the arch-doc-bot style: TL;DR, what changed, system/data flow, endpoints/surfaces, data structures, review hot-spots, open questions. Keep it under 600 words. Use line refs when supplied by the diff context. Mermaid diagrams must be brief and valid: avoid semicolons in sequenceDiagram messages, quote risky labels, no HTML.

PR #${pr.overview.number}: ${pr.overview.title}`;
}

function buildReviewContext(pr: PrData, rawDiff: string): string {
  const compactFiles = pr.files.map((file) => `${file.status} ${file.path} +${file.additions}/-${file.deletions}`).join('\n');
  return [
    `Title: ${pr.overview.title}`,
    `Body:\n${pr.overview.body || '(empty)'}`,
    `Files:\n${compactFiles}`,
    `Checks:\n${pr.checks.map((check) => `${check.state} ${check.name}: ${check.description}`).join('\n') || '(none)'}`,
    `Comments:\n${pr.comments.map((comment) => `${comment.author.login}: ${comment.body}`).join('\n') || '(none)'}`,
    `Reviews:\n${pr.reviews.map((review) => `${review.author.login} ${review.state}: ${review.body}`).join('\n') || '(none)'}`,
    `Unified diff:\n${rawDiff.slice(0, 60_000)}`,
  ].join('\n\n');
}

function parseAiReview(raw: string): ReviewIntelligence | undefined {
  const jsonText = extractJson(raw);
  if (!jsonText) return undefined;

  try {
    const value = JSON.parse(jsonText) as ReviewIntelligence;
    if (!value.summary || !Array.isArray(value.mindMap)) return undefined;
    return {
      summary: normalizeSummary(value.summary),
      mindMap: value.mindMap.filter(isMindMapGroup),
    };
  } catch {
    return undefined;
  }
}

function extractJson(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const match = /\{[\s\S]*\}/.exec(trimmed);
  return match?.[0];
}

function normalizeSummary(summary: AiSummary): AiSummary {
  return {
    purpose: summary.purpose || summary.tldr || 'AI-generated review summary',
    impact: summary.impact || summary.systemFlow?.join(' ') || 'Impact inferred by AI review.',
    concerns: Array.isArray(summary.concerns) ? summary.concerns : summary.hotSpots ?? [],
    highlights: Array.isArray(summary.highlights) ? summary.highlights : summary.whatChanged ?? [],
    tldr: summary.tldr,
    whatChanged: summary.whatChanged ?? [],
    systemFlow: summary.systemFlow ?? [],
    endpoints: summary.endpoints ?? [],
    dataStructures: summary.dataStructures ?? [],
    hotSpots: summary.hotSpots ?? [],
    openQuestions: summary.openQuestions ?? [],
    sourceReferences: summary.sourceReferences ?? [],
    generatedBy: 'ai',
  };
}

function isMindMapGroup(group: MindMapGroup): group is MindMapGroup {
  return Boolean(group && typeof group.label === 'string' && typeof group.description === 'string' && Array.isArray(group.files));
}

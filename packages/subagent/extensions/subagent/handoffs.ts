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

const DEFAULT_MAX_RAW_CHARS = 4000;
const MAX_SUMMARY_ITEMS = 3;
const SECTION_RE = /^##\s+(.+)$/gm;
const CODE_SYMBOL_RE =
  /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[:=]|^(?:export\s+)?(?:interface|type|class|enum)\s+([A-Za-z_$][\w$]*)/gm;
const BULLET_SYMBOL_RE =
  /^\s*(?:[-*]|\d+\.)\s+`?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)`?(?=\s*(?:-|:|\())/gm;
const PATH_RE = /\b(?:\.?\.?\/)?(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+(?:\.[A-Za-z0-9_.-]+)?\b/g;
const CODE_PATH_RE = /`([^`\n]+(?:\/[A-Za-z0-9_.-]+)+[^`\n]*)`/g;

interface SectionEntry {
  title: string;
  body: string;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeSectionTitle(title: string): string {
  return title.trim().toLowerCase().replace(/[\s/]+/g, ' ').replace(/[():]/g, '');
}

function splitMarkdownSections(markdown: string): { preamble: string; sections: SectionEntry[] } {
  const matches = Array.from(markdown.matchAll(SECTION_RE));
  if (matches.length === 0) {
    return { preamble: normalizeWhitespace(markdown), sections: [] };
  }

  const sections: SectionEntry[] = [];
  const preamble = normalizeWhitespace(markdown.slice(0, matches[0]?.index ?? 0));

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const title = current[1]?.trim() ?? '';
    const start = (current.index ?? 0) + current[0].length;
    const end = next?.index ?? markdown.length;
    const body = normalizeWhitespace(markdown.slice(start, end));
    sections.push({ title, body });
  }

  return { preamble, sections };
}

function getSectionBodies(sections: SectionEntry[], titles: string[]): string[] {
  const wanted = new Set(titles.map(normalizeSectionTitle));
  return sections
    .filter((section) => wanted.has(normalizeSectionTitle(section.title)))
    .map((section) => section.body)
    .filter(Boolean);
}

function getFirstSectionBody(sections: SectionEntry[], titles: string[]): string | undefined {
  return getSectionBodies(sections, titles)[0];
}

function extractListItems(section: string | undefined): string[] {
  if (!section) return [];

  const matches = Array.from(section.matchAll(/^\s*(?:[-*]|\d+\.)\s+(.+)$/gm));
  if (matches.length === 0) return [];

  return matches
    .map((match) => normalizeWhitespace(match[1] ?? ''))
    .map((item) => item.replace(/^[`*_]+|[`*_]+$/g, '').trim())
    .filter(Boolean);
}

function extractParagraph(section: string | undefined): string | undefined {
  if (!section) return undefined;
  const paragraph = normalizeWhitespace(section.split(/\n\n+/)[0] ?? '');
  const normalized = paragraph.replace(/^[-*]\s+/, '').trim();
  return normalized && !isSentinelItem(normalized) ? paragraph : undefined;
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 14)).trimEnd()}\n… (truncated)`;
}

function isSentinelItem(value: string): boolean {
  return /^(?:none|n\/a|not applicable)$/i.test(value.trim());
}

function uniq(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value && !isSentinelItem(value))),
  );
}

function summarizeBullets(items: string[]): string | undefined {
  const filtered = items.filter((item) => !isSentinelItem(item));
  if (filtered.length === 0) return undefined;
  return filtered.slice(0, MAX_SUMMARY_ITEMS).join('; ');
}

function summarizeSection(section: string | undefined): string | undefined {
  if (!section) return undefined;
  return summarizeBullets(extractListItems(section)) ?? extractParagraph(section);
}

function buildSummary(preamble: string, sections: SectionEntry[]): string {
  const parts = [
    summarizeSection(getFirstSectionBody(sections, ['Goal', 'Completed'])),
    summarizeSection(getFirstSectionBody(sections, ['Plan', 'Architecture', 'Integration Notes'])),
    summarizeSection(getFirstSectionBody(sections, ['Recommended Next Step', 'Notes', 'Risks'])),
    extractParagraph(preamble),
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.slice(0, MAX_SUMMARY_ITEMS).join(' ') : '(no summary available)';
}

function extractPaths(text: string): HandoffFileRef[] {
  const seen = new Set<string>();
  const files: HandoffFileRef[] = [];

  const addPath = (rawPath: string, notes?: string) => {
    const path = rawPath.trim().replace(/^`|`$/g, '').replace(/[),.:;]+$/g, '');
    if (!path.includes('/')) return;
    if (path.startsWith('http://') || path.startsWith('https://')) return;
    if (seen.has(path)) return;
    seen.add(path);
    files.push({ path, notes });
  };

  for (const match of text.matchAll(CODE_PATH_RE)) {
    addPath(match[1] ?? '');
  }

  for (const match of text.matchAll(PATH_RE)) {
    addPath(match[0] ?? '');
  }

  return files;
}

function extractSymbols(text: string): string[] {
  const symbols: string[] = [];

  for (const match of text.matchAll(CODE_SYMBOL_RE)) {
    const symbol = match[1] ?? match[2] ?? match[3];
    if (symbol) symbols.push(symbol);
  }

  for (const match of text.matchAll(BULLET_SYMBOL_RE)) {
    const symbol = match[1];
    if (symbol && !symbol.includes('/')) symbols.push(symbol);
  }

  return uniq(symbols);
}

function toQuestions(items: string[]): string[] {
  return items.filter(
    (item) =>
      /\?$/.test(item) || /\b(?:unknown|unclear|unresolved|question|follow up|todo)\b/i.test(item),
  );
}

function renderList(title: string, items: string[]): string[] {
  if (items.length === 0) return [];
  return [`## ${title}`, ...items.map((item) => `- ${item}`), ''];
}

export function buildHandoffFromResult(input: {
  agent: string;
  step?: number;
  task: string;
  output: string;
}): HandoffEnvelope {
  const output = input.output.trim() || '(no output)';
  const { preamble, sections } = splitMarkdownSections(output);
  const decisions = uniq(extractListItems(getFirstSectionBody(sections, ['Decisions'])));
  const explicitConstraints = uniq(
    extractListItems(getFirstSectionBody(sections, ['Constraints', 'Constraints or Unknowns'])),
  );
  const riskItems = uniq(extractListItems(getFirstSectionBody(sections, ['Risks'])));
  const openQuestions = uniq([
    ...extractListItems(getFirstSectionBody(sections, ['Open Questions'])),
    ...toQuestions(extractListItems(getFirstSectionBody(sections, ['Notes', 'Constraints or Unknowns']))),
  ]);
  const goal =
    extractParagraph(getFirstSectionBody(sections, ['Goal'])) ??
    extractParagraph(getFirstSectionBody(sections, ['Completed'])) ??
    undefined;

  return {
    version: 'subagent-handoff/v1',
    sourceAgent: input.agent,
    sourceStep: input.step,
    task: input.task,
    summary: buildSummary(preamble, sections),
    goal,
    decisions,
    constraints: uniq([...explicitConstraints, ...riskItems]),
    files: extractPaths(output),
    symbols: extractSymbols(output),
    openQuestions,
    rawOutput: output,
  };
}

export function renderHandoffForPrompt(
  handoff: HandoffEnvelope,
  options: RenderHandoffOptions = {},
): string {
  const includeRawOutput = options.includeRawOutput ?? true;
  const maxRawChars = options.maxRawChars ?? DEFAULT_MAX_RAW_CHARS;
  const lines: string[] = [
    '## Previous Agent Handoff',
    `- Source Agent: ${handoff.sourceAgent}`,
    ...(handoff.sourceStep ? [`- Step: ${handoff.sourceStep}`] : []),
    `- Task: ${truncate(handoff.task, 240)}`,
    `- Summary: ${handoff.summary}`,
    '',
  ];

  if (handoff.goal) {
    lines.push('## Goal', handoff.goal, '');
  }

  lines.push(...renderList('Decisions', handoff.decisions));
  lines.push(...renderList('Constraints', handoff.constraints));

  if (handoff.files.length > 0) {
    lines.push('## Files');
    for (const file of handoff.files) {
      lines.push(file.notes ? `- \`${file.path}\` - ${file.notes}` : `- \`${file.path}\``);
    }
    lines.push('');
  }

  lines.push(...renderList('Symbols', handoff.symbols));
  lines.push(...renderList('Open Questions', handoff.openQuestions));

  if (includeRawOutput) {
    lines.push(
      '## Raw Output (truncated)',
      '```markdown',
      truncate(handoff.rawOutput, maxRawChars),
      '```',
      '',
    );
  }

  return lines.join('\n').trim();
}

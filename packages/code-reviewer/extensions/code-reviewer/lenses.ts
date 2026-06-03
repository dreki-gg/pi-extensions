import { Effect } from 'effect';
import { basename, resolve } from 'node:path';

import { FileSystem, nodeFileSystemService } from './effects/filesystem';
import type { LensConfig, LensSeverity } from './types';

type SectionKind = 'top' | 'criteria' | 'tools' | 'severity';

const SECTION_MAP: Record<string, SectionKind> = {
  '## criteria': 'criteria',
  '## tools': 'tools',
  '## severity': 'severity',
};

type ParseState = {
  name: string;
  description: string;
  criteriaLines: string[];
  tools: string[];
  severityRules: Record<LensSeverity, string>;
};

type LineHandler = (trimmed: string, state: ParseState) => void;

const SECTION_HANDLERS: Record<SectionKind, LineHandler> = {
  top: (trimmed, state) => {
    if (!state.description) state.description = trimmed;
  },
  criteria: (trimmed, state) => state.criteriaLines.push(trimmed),
  tools: (trimmed, state) => parseTool(trimmed, state.tools),
  severity: (trimmed, state) => parseSeverityRule(trimmed, state.severityRules),
};

/** Parse a lens markdown file into a structured LensConfig. */
function parseLensFile(content: string, filename: string): LensConfig {
  const state: ParseState = {
    name: basename(filename, '.md'),
    description: '',
    criteriaLines: [],
    tools: [],
    severityRules: { blocker: '', warning: '', note: '' },
  };

  let section: SectionKind = 'top';

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      state.name = trimmed.slice(2).trim();
      continue;
    }

    const nextSection = detectSection(trimmed);
    if (nextSection !== undefined) {
      section = nextSection;
      continue;
    }

    if (trimmed) SECTION_HANDLERS[section](trimmed, state);
  }

  return {
    name: state.name,
    description: state.description,
    criteria: state.criteriaLines.join('\n'),
    tools: state.tools,
    severityRules: state.severityRules,
  };
}

/** Detect which section a heading line introduces, or undefined if not a section heading. */
function detectSection(trimmed: string): SectionKind | undefined {
  if (!trimmed.startsWith('## ')) return undefined;
  return SECTION_MAP[trimmed.toLowerCase()] ?? 'top';
}

/** Extract a tool command from a list item line. */
function parseTool(trimmed: string, tools: string[]): void {
  const backtickMatch = trimmed.match(/^-\s*`(.+)`$/);
  if (backtickMatch) {
    tools.push(backtickMatch[1]);
  } else if (trimmed.startsWith('- ') && trimmed.length > 2) {
    tools.push(trimmed.slice(2));
  }
}

/** Extract a severity rule from a list item line. */
function parseSeverityRule(trimmed: string, rules: Record<LensSeverity, string>): void {
  const match = trimmed.match(/^-\s*(blocker|warning|note):\s*(.+)$/i);
  if (match) {
    rules[match[1].toLowerCase() as LensSeverity] = match[2];
  }
}

/** Discover all lens files in a directory (missing dir → empty map). */
export function discoverLensesEffect(
  lensDir: string,
): Effect.Effect<Map<string, LensConfig>, never, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    const lenses = new Map<string, LensConfig>();

    const entries = yield* fs.readDirectory(lensDir).pipe(Effect.either);
    if (entries._tag === 'Left') return lenses;

    for (const file of entries.right.filter((f) => f.endsWith('.md'))) {
      const content = yield* fs.readTextFile(resolve(lensDir, file)).pipe(Effect.either);
      if (content._tag === 'Left') continue;
      const key = basename(file, '.md');
      lenses.set(key, parseLensFile(content.right, file));
    }

    return lenses;
  });
}

/** Get raw markdown content for a lens to pass to the reviewer agent. */
export function getLensContentEffect(
  lensDir: string,
  lensName: string,
): Effect.Effect<string | null, never, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    const content = yield* fs.readTextFile(resolve(lensDir, `${lensName}.md`)).pipe(Effect.either);
    return content._tag === 'Right' ? content.right : null;
  });
}

// ── Promise wrappers (live FileSystem provided) ──────────────────────────────

export function discoverLenses(lensDir: string): Promise<Map<string, LensConfig>> {
  return Effect.runPromise(
    discoverLensesEffect(lensDir).pipe(Effect.provideService(FileSystem, nodeFileSystemService)),
  );
}

export function getLensContent(lensDir: string, lensName: string): Promise<string | null> {
  return Effect.runPromise(
    getLensContentEffect(lensDir, lensName).pipe(
      Effect.provideService(FileSystem, nodeFileSystemService),
    ),
  );
}

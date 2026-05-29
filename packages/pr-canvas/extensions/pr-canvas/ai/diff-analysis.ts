import type { PrData, PrFile } from '../github/types';
import type { ReviewDataStructure, ReviewSurface, SourceReference } from './types';

export interface FileReference {
  path: string;
  start: number;
  end: number;
}

export function formatReference(ref: FileReference): string {
  return `${ref.path}:L${ref.start}${ref.end > ref.start ? `-L${ref.end}` : ''}`;
}

export function firstAddedRange(file: PrFile): FileReference | undefined {
  const ranges = addedRanges(file);
  return ranges[0];
}

export function addedRanges(file: PrFile): FileReference[] {
  const ranges: FileReference[] = [];
  let newLine = 0;
  let current: FileReference | undefined;

  for (const line of file.patch.split('\n')) {
    const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (header) {
      if (current) ranges.push(current);
      current = undefined;
      newLine = Number(header[1]);
      continue;
    }

    if (line.startsWith('+++') || line.startsWith('---')) continue;

    if (line.startsWith('+')) {
      if (!current) current = { path: file.path, start: newLine, end: newLine };
      else current.end = newLine;
      newLine += 1;
      continue;
    }

    if (current) {
      ranges.push(current);
      current = undefined;
    }

    if (!line.startsWith('-')) newLine += 1;
  }

  if (current) ranges.push(current);
  return ranges;
}

export function sourceForLine(file: PrFile, lineText: string): string | undefined {
  let newLine = 0;
  for (const line of file.patch.split('\n')) {
    const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (header) {
      newLine = Number(header[1]);
      continue;
    }

    if (line.startsWith('+++') || line.startsWith('---')) continue;

    if (line.startsWith('+')) {
      if (line.includes(lineText)) return `${file.path}:L${newLine}`;
      newLine += 1;
      continue;
    }

    if (!line.startsWith('-')) newLine += 1;
  }
  return undefined;
}

export function detectSurfaces(pr: PrData): ReviewSurface[] {
  const surfaces: ReviewSurface[] = [];

  for (const file of pr.files) {
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file.path)) continue;

    const removedRoutes = new Map<string, string>();
    for (const raw of file.patch.split('\n')) {
      const removed = /^-\s*router\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/.exec(raw);
      if (removed) removedRoutes.set(`${removed[1].toUpperCase()} ${removed[2]}`, raw);
    }

    for (const raw of file.patch.split('\n')) {
      const added =
        /^\+\s*router\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]\s*(?:,\s*([^,()]+))?/.exec(
          raw,
        );
      if (!added) continue;

      const method = added[1].toUpperCase();
      const path = added[2];
      const key = `${method} ${path}`;
      const maybeMiddleware = added[3]?.trim() ?? '';
      const source = sourceForLine(file, raw.slice(1).trim());

      surfaces.push({
        method,
        path,
        auth:
          maybeMiddleware && !maybeMiddleware.includes('req')
            ? maybeMiddleware
            : 'not visible in route signature',
        requestShape:
          method === 'GET'
            ? 'query/path params only (body not visible)'
            : 'not inferable from diff',
        responseShape: inferResponseShape(raw),
        change: removedRoutes.has(key) ? 'CHANGED' : 'NEW',
        source,
      });
    }
  }

  return surfaces;
}

export function detectDataStructures(pr: PrData): ReviewDataStructure[] {
  const structures: ReviewDataStructure[] = [];

  for (const file of pr.files) {
    if (!/\.(ts|tsx)$/.test(file.path)) continue;

    const lines = file.patch.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const match = /^\+export\s+interface\s+(\w+)/.exec(line);
      if (!match) continue;

      const fields = [];
      for (let j = i + 1; j < lines.length; j += 1) {
        const fieldLine = lines[j];
        if (/^\+}/.test(fieldLine)) break;
        const field = /^\+\s*(\w+)(\??):\s*([^;]+);?/.exec(fieldLine);
        if (field) {
          fields.push({
            name: field[1],
            type: field[3].trim(),
            required: field[2] === '?' ? 'no' : 'yes',
            description: 'Introduced or changed in this PR',
          });
        }
      }

      structures.push({
        name: match[1],
        source:
          sourceForLine(file, `export interface ${match[1]}`) ??
          formatReference(firstAddedRange(file) ?? { path: file.path, start: 1, end: 1 }),
        fields,
      });
    }
  }

  return structures;
}

export function buildSourceReferences(pr: PrData): SourceReference[] {
  return pr.files
    .map((file) => {
      const ref = firstAddedRange(file);
      if (!ref) return undefined;
      return {
        path: file.path,
        range: `L${ref.start}${ref.end > ref.start ? `-L${ref.end}` : ''}`,
        reason: describeFileRole(file),
      };
    })
    .filter((ref): ref is SourceReference => Boolean(ref));
}

export function describeFileRole(file: PrFile): string {
  if (/\b(test|tests|spec|__tests__)\b|\.(test|spec)\./.test(file.path)) return 'test coverage';
  if (/route|api|controller|handler/.test(file.path)) return 'callable surface';
  if (/middleware|auth|permission|token/i.test(file.path)) return 'auth/control-flow boundary';
  if (/schema|type|model|entity|dto/i.test(file.path)) return 'data structure';
  if (/README|docs?|\.md$/i.test(file.path)) return 'documentation';
  return 'changed implementation';
}

export function hasSecretFallback(pr: PrData): string | undefined {
  for (const file of pr.files) {
    const line = file.patch
      .split('\n')
      .find(
        (entry) =>
          /^\+/.test(entry) &&
          /secret|token|password|api[_-]?key/i.test(entry) &&
          /default|fallback|hardcoded|['"][^'"]+['"]/.test(entry),
      );
    if (line) return sourceForLine(file, line.slice(1).trim()) ?? file.path;
  }
  return undefined;
}

function inferResponseShape(routeLine: string): string {
  const json = /res\.json\((\{[^)]*\})\)/.exec(routeLine);
  if (!json) return 'not inferable from diff';
  return json[1].replace(/\s+/g, ' ');
}

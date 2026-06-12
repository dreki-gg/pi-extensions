import { readFileSync, statSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';

// The detection engine is a dependency-free port of impeccable's static
// (no-browser) engine. Imported as .mjs; typed at the boundary cast below.
import * as engine from './detector/detect-antipatterns.mjs';

const { detectText, detectHtml, walkDir, buildImportGraph, HTML_EXTENSIONS } = engine as {
  detectText: (content: string, file: string, opts: EngineOptions) => RawFinding[];
  detectHtml: (file: string, opts: EngineOptions) => Promise<RawFinding[]>;
  walkDir: (dir: string) => string[];
  buildImportGraph: (files: string[]) => Map<string, Set<string>>;
  HTML_EXTENSIONS: Set<string>;
};

type Provider = 'gpt' | 'gemini';

interface EngineOptions {
  providers: Provider[];
}

interface RawFinding {
  antipattern: string;
  name: string;
  description: string;
  severity: string;
  file: string;
  line: number;
  snippet: string;
}

export interface DetectFinding extends RawFinding {
  importedBy?: string[];
}

export interface DetectOptions {
  providers?: Provider[];
}

const isHtml = (file: string): boolean => HTML_EXTENSIONS.has(extname(file).toLowerCase());

/** Run the static detection engine over a single file. */
async function scanFile(file: string, opts: EngineOptions): Promise<RawFinding[]> {
  if (isHtml(file)) return detectHtml(file, opts);
  return detectText(readFileSync(file, 'utf-8'), file, opts);
}

/**
 * Scan files, directories, or globs already resolved to paths for design
 * anti-patterns. Directories are walked recursively; import context is
 * annotated so a finding in a shared file reports who pulls it in. Missing or
 * unreadable targets are skipped rather than throwing — a detector should
 * degrade, not abort a review.
 */
export async function detectTargets(
  targets: string[],
  options: DetectOptions = {},
): Promise<DetectFinding[]> {
  const opts: EngineOptions = { providers: options.providers ?? [] };
  const files: string[] = [];

  for (const target of targets) {
    const path = resolve(target);
    let stat;
    try {
      stat = statSync(path);
    } catch {
      continue; // missing / unreadable target — skip
    }
    if (stat.isDirectory()) files.push(...walkDir(path));
    else if (stat.isFile()) files.push(path);
  }

  // Reverse the import graph: file -> names of files that import it.
  const importedBy = new Map<string, string[]>();
  if (files.length > 1) {
    const graph = buildImportGraph(files);
    const reverse = new Map<string, Set<string>>();
    for (const [importer, imports] of graph) {
      for (const imported of imports) {
        if (!reverse.has(imported)) reverse.set(imported, new Set());
        reverse.get(imported)!.add(importer);
      }
    }
    for (const [file, importers] of reverse) {
      importedBy.set(
        file,
        [...importers].map((f) => basename(f)),
      );
    }
  }

  const findings: DetectFinding[] = [];
  for (const file of files) {
    let fileFindings: RawFinding[];
    try {
      fileFindings = await scanFile(file, opts);
    } catch {
      continue; // a malformed file should not sink the whole scan
    }
    const importers = importedBy.get(file);
    for (const f of fileFindings) {
      findings.push(importers ? { ...f, importedBy: importers } : f);
    }
  }

  return findings;
}

/** Group findings by file into a human-readable report. */
export function formatFindings(findings: DetectFinding[]): string {
  if (findings.length === 0) return 'No anti-patterns found. 0 anti-patterns.';

  const grouped = new Map<string, DetectFinding[]>();
  for (const f of findings) {
    if (!grouped.has(f.file)) grouped.set(f.file, []);
    grouped.get(f.file)!.push(f);
  }

  const out: string[] = [];
  for (const [file, items] of grouped) {
    const note = items[0]?.importedBy?.length
      ? ` (imported by ${items[0].importedBy.join(', ')})`
      : '';
    out.push(`\n${file}${note}`);
    for (const item of items) {
      const where = item.line ? `line ${item.line}: ` : '';
      out.push(`  ${where}[${item.antipattern}] ${item.snippet}`);
      out.push(`    \u2192 ${item.description}`);
    }
  }
  const n = findings.length;
  out.push(`\n${n} anti-pattern${n === 1 ? '' : 's'} found.`);
  return out.join('\n');
}

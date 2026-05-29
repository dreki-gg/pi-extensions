import type { PrData } from '../github/types';
import type { MindMapGroup } from './types';

/**
 * Generate semantic groupings of file changes using heuristic analysis.
 *
 * Groups files by directory structure and detected patterns (tests, config, docs, etc.)
 * to provide a meaningful mental model of the PR's changes.
 */
export function generateHeuristicMindMap(pr: PrData): MindMapGroup[] {
  const files = pr.files;
  if (files.length === 0) return [];

  const groups: MindMapGroup[] = [];
  const assigned = new Set<string>();

  // 1. Test files
  const testFiles = files.filter((f) => isTestFile(f.path));
  if (testFiles.length > 0) {
    groups.push({
      label: 'Test Coverage',
      description: `${testFiles.length} test file${testFiles.length > 1 ? 's' : ''} ${describeTestChanges(testFiles)}`,
      files: testFiles.map((f) => f.path),
      changeType: 'test',
    });
    testFiles.forEach((f) => assigned.add(f.path));
  }

  // 2. Config / build files
  const configFiles = files.filter((f) => !assigned.has(f.path) && isConfigFile(f.path));
  if (configFiles.length > 0) {
    groups.push({
      label: 'Configuration',
      description: `Build and configuration changes`,
      files: configFiles.map((f) => f.path),
      changeType: 'config',
    });
    configFiles.forEach((f) => assigned.add(f.path));
  }

  // 3. Documentation
  const docFiles = files.filter((f) => !assigned.has(f.path) && isDocFile(f.path));
  if (docFiles.length > 0) {
    groups.push({
      label: 'Documentation',
      description: `Documentation updates`,
      files: docFiles.map((f) => f.path),
      changeType: 'docs',
    });
    docFiles.forEach((f) => assigned.add(f.path));
  }

  // 4. Group remaining source files by top-level directory
  const remaining = files.filter((f) => !assigned.has(f.path));
  const byDir = groupByDirectory(remaining);

  for (const [dir, dirFiles] of Object.entries(byDir)) {
    const changeType = detectChangeType(dirFiles);
    const label = formatDirectoryLabel(dir);

    groups.push({
      label,
      description: describeDirectoryChanges(dirFiles),
      files: dirFiles.map((f) => f.path),
      changeType,
    });
  }

  return groups;
}

function isTestFile(path: string): boolean {
  return /\b(test|tests|spec|specs|__tests__|__test__)\b/i.test(path) ||
    /\.(test|spec)\.\w+$/.test(path) ||
    /\.test$/.test(path);
}

function isConfigFile(path: string): boolean {
  const name = path.split('/').pop() ?? '';
  return /^(tsconfig|package|jest\.config|vitest\.config|webpack|vite\.config|rollup|babel|\.eslint|\.prettier|Dockerfile|docker-compose|Makefile|\.github)/i.test(name) ||
    /\.(json|ya?ml|toml|ini|env)$/.test(name) && !path.includes('src/');
}

function isDocFile(path: string): boolean {
  const name = path.split('/').pop() ?? '';
  return /\.(md|mdx|txt|rst)$/i.test(name) ||
    /^docs?\//i.test(path) ||
    /^(README|CHANGELOG|CONTRIBUTING|LICENSE|AUTHORS)/i.test(name);
}

function groupByDirectory(
  files: { path: string; status: string; additions: number; deletions: number }[],
): Record<string, typeof files> {
  const groups: Record<string, typeof files> = {};

  for (const file of files) {
    const parts = file.path.split('/');
    // Use first two directory levels for grouping, or just the file name
    const key = parts.length > 2 ? `${parts[0]}/${parts[1]}` : parts.length > 1 ? parts[0] : '(root)';

    if (!groups[key]) groups[key] = [];
    groups[key].push(file);
  }

  return groups;
}

function detectChangeType(
  files: { status: string; additions: number; deletions: number }[],
): MindMapGroup['changeType'] {
  const allAdded = files.every((f) => f.status === 'added');
  const allDeleted = files.every((f) => f.status === 'deleted');

  if (allAdded) return 'feature';
  if (allDeleted) return 'refactor';

  // If mostly modifications with balanced add/delete, likely refactor
  const totalAdd = files.reduce((s, f) => s + f.additions, 0);
  const totalDel = files.reduce((s, f) => s + f.deletions, 0);

  if (totalDel > 0 && totalAdd / totalDel < 1.5 && totalAdd / totalDel > 0.5) {
    return 'refactor';
  }

  if (totalAdd > totalDel * 3) return 'feature';

  return 'other';
}

function formatDirectoryLabel(dir: string): string {
  if (dir === '(root)') return 'Root Files';
  return dir
    .split('/')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ');
}

function describeDirectoryChanges(
  files: { status: string; additions: number; deletions: number }[],
): string {
  const added = files.filter((f) => f.status === 'added').length;
  const modified = files.filter((f) => f.status === 'modified').length;
  const deleted = files.filter((f) => f.status === 'deleted').length;

  const parts = [];
  if (added > 0) parts.push(`${added} new`);
  if (modified > 0) parts.push(`${modified} modified`);
  if (deleted > 0) parts.push(`${deleted} removed`);

  return parts.join(', ') || 'Changes in this area';
}

function describeTestChanges(
  files: { status: string }[],
): string {
  const added = files.filter((f) => f.status === 'added').length;
  const modified = files.filter((f) => f.status === 'modified').length;

  if (added > 0 && modified === 0) return 'added';
  if (modified > 0 && added === 0) return 'updated';
  return 'changed';
}

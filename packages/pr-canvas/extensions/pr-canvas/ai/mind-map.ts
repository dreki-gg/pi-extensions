import type { PrData } from '../github/types';
import { detectDataStructures, detectSurfaces } from './diff-analysis';
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

  const flowGroup = buildFlowGroup(pr);
  if (flowGroup) {
    groups.push(flowGroup);
    flowGroup.files.forEach((file) => assigned.add(file));
  }

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

function buildFlowGroup(pr: PrData): MindMapGroup | undefined {
  const surfaces = detectSurfaces(pr);
  const dataStructures = detectDataStructures(pr);
  const sourceFiles = pr.files.filter(
    (file) =>
      !isTestFile(file.path) &&
      !isConfigFile(file.path) &&
      !isDocFile(file.path) &&
      /\.(ts|tsx|js|jsx|go|rs|py|rb)$/.test(file.path),
  );
  const flowFiles = sourceFiles.filter((file) =>
    /route|api|handler|controller|middleware|auth|token|service|lib|type|schema|model/i.test(
      file.path,
    ),
  );

  if (surfaces.length === 0 && dataStructures.length === 0 && flowFiles.length < 2)
    return undefined;

  const files = [
    ...new Set([
      ...(flowFiles.length > 0 ? flowFiles : sourceFiles).map((file) => file.path),
      ...dataStructures.map((structure) => structure.source.split(':L')[0]),
    ]),
  ];
  const hasAuth = files.some((file) => /auth|token|middleware/i.test(file));
  const hasService = files.some((file) => /service/i.test(file));
  const hasLibrary = files.some((file) => /\/lib\//i.test(file));
  const label = inferFlowLabel(pr.overview.title, {
    hasAuth,
    hasService,
    hasLibrary,
    surfaces: surfaces.length,
    dataStructures: dataStructures.length,
  });
  const relationships = [];

  if (surfaces.length > 0) {
    relationships.push(
      `Routes changed: ${surfaces.map((surface) => `${surface.method} ${surface.path}`).join(', ')}`,
    );
  }
  if (hasAuth)
    relationships.push(
      'Requests pass through authMiddleware/token validation before protected handlers continue.',
    );
  if (hasService)
    relationships.push(
      `Service boundary changed: ${files.filter((file) => /service/i.test(file)).join(', ')}`,
    );
  if (hasLibrary)
    relationships.push(
      `Shared library behavior changed: ${files.filter((file) => /\/lib\//i.test(file)).join(', ')}`,
    );
  if (dataStructures.length > 0)
    relationships.push(
      `New data shapes: ${dataStructures.map((structure) => structure.name).join(', ')}`,
    );

  return {
    label,
    description: relationships[0] ?? 'Mental model of the main changed flow and data contracts.',
    files,
    changeType:
      surfaces.some((surface) => surface.change === 'NEW') ||
      pr.files.some((file) => file.status === 'added')
        ? 'feature'
        : 'refactor',
    diagram: buildMermaidDiagram(surfaces, hasAuth, dataStructures, files),
    relationships,
  };
}

function inferFlowLabel(
  title: string,
  signals: {
    hasAuth: boolean;
    hasService: boolean;
    hasLibrary: boolean;
    surfaces: number;
    dataStructures: number;
  },
): string {
  if (signals.hasAuth) return 'Request Auth Flow';
  if (/signed.?url|file|download|upload/i.test(title)) return 'File Access Flow';
  if (signals.surfaces > 0) return 'Callable Surface Flow';
  if (signals.hasService && signals.hasLibrary) return 'Service → Library Flow';
  if (signals.hasService) return 'Service Flow';
  if (signals.dataStructures > 0) return 'Data Model Flow';
  return 'Change Flow';
}

function buildMermaidDiagram(
  surfaces: ReturnType<typeof detectSurfaces>,
  hasAuth: boolean,
  dataStructures: ReturnType<typeof detectDataStructures>,
  files: string[],
): string {
  if (surfaces.length > 0) {
    const lines = ['sequenceDiagram', '  participant Caller', '  participant API'];
    if (hasAuth) lines.push('  participant Auth as AuthMiddleware');
    lines.push('  participant Handler');

    for (const surface of surfaces.slice(0, 5)) {
      lines.push(`  Caller->>API: ${surface.method} ${surface.path}`);
      if (hasAuth && surface.auth !== 'not visible in route signature') {
        lines.push(`  API->>Auth: ${surface.auth}`);
        lines.push('  Auth-->>API: user identity or rejection');
      }
      lines.push('  API->>Handler: continue request');
      if (surface.responseShape !== 'not inferable from diff')
        lines.push(`  Handler-->>Caller: ${sanitizeMermaidMessage(surface.responseShape)}`);
    }

    return lines.join('\n');
  }

  const serviceFiles = files.filter((file) => /service/i.test(file));
  const libFiles = files.filter((file) => /\/lib\//i.test(file));
  const typeFiles = files.filter((file) => /type|schema|model/i.test(file));

  if (serviceFiles.length > 0 || libFiles.length > 0 || typeFiles.length > 0) {
    const lines = ['flowchart TD'];
    if (serviceFiles.length > 0)
      lines.push(`  Service["${sanitizeMermaidLabel(shortFileList(serviceFiles))}"]`);
    if (libFiles.length > 0)
      lines.push(`  Library["${sanitizeMermaidLabel(shortFileList(libFiles))}"]`);
    if (typeFiles.length > 0 || dataStructures.length > 0)
      lines.push(
        `  Types["${sanitizeMermaidLabel(dataStructures.length > 0 ? dataStructures.map((structure) => structure.name).join(', ') : shortFileList(typeFiles))}"]`,
      );
    if (serviceFiles.length > 0 && libFiles.length > 0) lines.push('  Service --> Library');
    if (libFiles.length > 0 && (typeFiles.length > 0 || dataStructures.length > 0))
      lines.push('  Library --> Types');
    if (
      serviceFiles.length > 0 &&
      libFiles.length === 0 &&
      (typeFiles.length > 0 || dataStructures.length > 0)
    )
      lines.push('  Service --> Types');
    if (lines.length > 1) return lines.join('\n');
  }

  if (dataStructures.length > 0) {
    return [
      'flowchart TD',
      '  Diff[PR diff]',
      ...dataStructures
        .slice(0, 5)
        .map((structure) => `  Diff --> ${structure.name}[${structure.name}]`),
    ].join('\n');
  }

  return 'flowchart TD\n  Change[Changed files] --> Review[Reviewer mental model]';
}

function shortFileList(files: string[]): string {
  return files
    .map((file) => file.split('/').pop() ?? file)
    .slice(0, 3)
    .join(', ');
}

function sanitizeMermaidLabel(value: string): string {
  return value.replace(/["`]/g, '').replace(/\s+/g, ' ').slice(0, 80);
}

function sanitizeMermaidMessage(value: string): string {
  return value.replace(/[;`]/g, ',').replace(/\s+/g, ' ').slice(0, 80);
}

function isTestFile(path: string): boolean {
  return (
    /\b(test|tests|spec|specs|__tests__|__test__)\b/i.test(path) ||
    /\.(test|spec)\.\w+$/.test(path) ||
    /\.test$/.test(path)
  );
}

function isConfigFile(path: string): boolean {
  const name = path.split('/').pop() ?? '';
  return (
    /^(tsconfig|package|jest\.config|vitest\.config|webpack|vite\.config|rollup|babel|\.eslint|\.prettier|Dockerfile|docker-compose|Makefile|\.github)/i.test(
      name,
    ) ||
    (/\.(json|ya?ml|toml|ini|env)$/.test(name) && !path.includes('src/'))
  );
}

function isDocFile(path: string): boolean {
  const name = path.split('/').pop() ?? '';
  return (
    /\.(md|mdx|txt|rst)$/i.test(name) ||
    /^docs?\//i.test(path) ||
    /^(README|CHANGELOG|CONTRIBUTING|LICENSE|AUTHORS)/i.test(name)
  );
}

function groupByDirectory(
  files: { path: string; status: string; additions: number; deletions: number }[],
): Record<string, typeof files> {
  const groups: Record<string, typeof files> = {};

  for (const file of files) {
    const parts = file.path.split('/');
    // Use first two directory levels for grouping, or just the file name
    const key =
      parts.length > 2 ? `${parts[0]}/${parts[1]}` : parts.length > 1 ? parts[0] : '(root)';

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

function describeTestChanges(files: { status: string }[]): string {
  const added = files.filter((f) => f.status === 'added').length;
  const modified = files.filter((f) => f.status === 'modified').length;

  if (added > 0 && modified === 0) return 'added';
  if (modified > 0 && added === 0) return 'updated';
  return 'changed';
}

/**
 * Propose how to split the current working changes into a stack of layers.
 *
 * v1 uses a deterministic, path-based heuristic so the proposal is fast and
 * predictable. The agent (skill) can override or refine the grouping before
 * the user confirms; this just provides a sensible default ordering.
 *
 * Ordering principle: lower layers should be safe to land ahead of higher
 * ones, so we order from foundational (schema/migrations) → backend → API →
 * frontend → tests/docs.
 */

export interface ChangedFile {
  path: string;
  /** git status code: A, M, D, R, etc. Optional, unused for grouping. */
  status?: string;
}

export interface ProposedLayer {
  /** Suggested branch name (kebab, no slashes). */
  branch: string;
  /** Suggested PR title. */
  title: string;
  /** Files assigned to this layer. */
  files: string[];
  /** Why these files were grouped together. */
  rationale: string;
}

interface Bucket {
  key: string;
  branch: string;
  title: string;
  rationale: string;
  match: (path: string) => boolean;
}

// Ordered foundational → surface. First matching bucket wins.
const BUCKETS: Bucket[] = [
  {
    key: 'schema',
    branch: 'layer-schema',
    title: 'Schema & migrations',
    rationale: 'Database schema, migrations, and generated types — safe to land first.',
    match: (p) => /(^|\/)(migrations?|schema|prisma|db)(\/|\.)/i.test(p) || /\.sql$/i.test(p),
  },
  {
    key: 'backend',
    branch: 'layer-backend',
    title: 'Backend & domain logic',
    rationale: 'Server-side domain logic and services.',
    match: (p) =>
      /(^|\/)(server|services?|domain|lib|core|backend|api\/.*\/(handler|service))/i.test(p),
  },
  {
    key: 'api',
    branch: 'layer-api',
    title: 'API surface',
    rationale: 'API routes / endpoints exposing the new backend behavior.',
    match: (p) => /(^|\/)(routes?|api|controllers?|endpoints?)(\/|\.)/i.test(p),
  },
  {
    key: 'frontend',
    branch: 'layer-frontend',
    title: 'Frontend',
    rationale: 'UI components and client code consuming the API.',
    match: (p) =>
      /(^|\/)(components?|pages?|views?|ui|app|client|frontend)(\/|\.)/i.test(p) ||
      /\.(tsx|jsx|vue|svelte|css|scss)$/i.test(p),
  },
  {
    key: 'tests',
    branch: 'layer-tests',
    title: 'Tests & docs',
    rationale: 'Tests and documentation — can land last or alongside their layer.',
    match: (p) => /(^|\/)(tests?|__tests__|docs?)(\/|\.)/i.test(p) || /\.(md|test\.\w+)$/i.test(p),
  },
];

/**
 * Group changed files into ordered proposed layers. Buckets with no files are
 * dropped. Files matching no bucket fall into a trailing "misc" layer.
 */
export function proposeSplit(files: ChangedFile[]): ProposedLayer[] {
  const assigned = new Map<string, string[]>();
  const misc: string[] = [];

  for (const file of files) {
    const bucket = BUCKETS.find((b) => b.match(file.path));
    if (bucket) {
      const list = assigned.get(bucket.key) ?? [];
      list.push(file.path);
      assigned.set(bucket.key, list);
    } else {
      misc.push(file.path);
    }
  }

  const layers: ProposedLayer[] = [];
  for (const bucket of BUCKETS) {
    const list = assigned.get(bucket.key);
    if (list && list.length > 0) {
      layers.push({
        branch: bucket.branch,
        title: bucket.title,
        files: list.sort(),
        rationale: bucket.rationale,
      });
    }
  }

  if (misc.length > 0) {
    layers.push({
      branch: 'layer-misc',
      title: 'Remaining changes',
      files: misc.sort(),
      rationale: 'Files that did not match a known layer; review grouping manually.',
    });
  }

  return layers;
}

/**
 * Heuristic: is the change large/varied enough to warrant stacking?
 * Returns a recommendation flag plus a reason.
 */
export function shouldRecommendSplit(
  files: ChangedFile[],
  totalChangedLines: number,
): { recommend: boolean; reason: string } {
  const layers = proposeSplit(files);
  const distinctLayers = layers.filter((l) => l.branch !== 'layer-misc').length;

  if (totalChangedLines >= 400 && distinctLayers >= 2) {
    return {
      recommend: true,
      reason: `~${totalChangedLines} changed lines across ${distinctLayers} subsystems — a stack improves reviewability.`,
    };
  }
  if (distinctLayers >= 3) {
    return {
      recommend: true,
      reason: `Changes span ${distinctLayers} subsystems — natural stack boundaries exist.`,
    };
  }
  return {
    recommend: false,
    reason: 'Change is small or single-subsystem; a single PR is fine.',
  };
}

/** Render a proposed split as a human-readable summary for confirmation. */
export function renderProposal(layers: ProposedLayer[]): string {
  if (layers.length === 0) return 'No changes to split.';
  return layers
    .map((layer, i) => {
      const head = `${i + 1}. ${layer.branch} — ${layer.title}`;
      const why = `   ${layer.rationale}`;
      const fileList = layer.files.map((f) => `     • ${f}`).join('\n');
      return `${head}\n${why}\n${fileList}`;
    })
    .join('\n\n');
}

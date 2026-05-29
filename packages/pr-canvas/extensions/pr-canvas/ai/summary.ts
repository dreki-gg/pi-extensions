import type { PrData } from '../github/types';
import type { AiSummary } from './types';

/**
 * Generate a heuristic summary of the PR based on metadata and file changes.
 *
 * This provides an immediate summary without requiring an LLM call.
 * AI-enhanced summaries can be added as a follow-up.
 */
export function generateHeuristicSummary(pr: PrData): AiSummary {
  return {
    purpose: derivePurpose(pr),
    impact: deriveImpact(pr),
    concerns: deriveConcerns(pr),
    highlights: deriveHighlights(pr),
  };
}

function derivePurpose(pr: PrData): string {
  const { overview } = pr;

  // Use first paragraph of body if available
  if (overview.body) {
    const firstPara = overview.body
      .split('\n\n')
      .find((p) => p.trim() && !p.trim().startsWith('#') && !p.trim().startsWith('- '));
    if (firstPara && firstPara.trim().length > 10) {
      return firstPara.trim().slice(0, 300);
    }
  }

  return overview.title;
}

function deriveImpact(pr: PrData): string {
  const { files, overview } = pr;
  const parts: string[] = [];

  // Unique top-level directories affected
  const dirs = new Set(files.map((f) => f.path.split('/')[0]));
  if (dirs.size > 0) {
    parts.push(`Affects ${dirs.size} top-level ${dirs.size === 1 ? 'area' : 'areas'}: ${[...dirs].join(', ')}`);
  }

  parts.push(`${overview.additions} lines added, ${overview.deletions} lines removed across ${files.length} files`);

  return parts.join('. ') + '.';
}

function deriveConcerns(pr: PrData): string[] {
  const concerns: string[] = [];
  const { files, overview, checks } = pr;

  // Large PR
  if (files.length > 20) {
    concerns.push(`Large PR with ${files.length} files — consider splitting`);
  }

  // Lots of deletions
  if (overview.deletions > 500) {
    concerns.push(`Significant deletions (${overview.deletions} lines) — verify nothing is lost`);
  }

  // No tests
  const hasTests = files.some(
    (f) =>
      f.status !== 'deleted' &&
      (/\.(test|spec)\.\w+$/.test(f.path) || /\b(test|tests|spec|__tests__)\b/.test(f.path)),
  );
  const hasSourceChanges = files.some(
    (f) => f.status !== 'deleted' && !(/\.(test|spec)\.\w+$/.test(f.path)) && /\.(ts|js|tsx|jsx|py|rb|go|rs)$/.test(f.path),
  );
  if (hasSourceChanges && !hasTests) {
    concerns.push('No test files modified — consider adding test coverage');
  }

  // Failed checks
  const failedChecks = checks.filter((c) => c.state === 'FAILURE' || c.state === 'STARTUP_FAILURE');
  if (failedChecks.length > 0) {
    concerns.push(`${failedChecks.length} CI check${failedChecks.length > 1 ? 's' : ''} failing: ${failedChecks.map((c) => c.name).join(', ')}`);
  }

  return concerns;
}

function deriveHighlights(pr: PrData): string[] {
  const highlights: string[] = [];
  const { files } = pr;

  // New files
  const newFiles = files.filter((f) => f.status === 'added');
  if (newFiles.length > 0) {
    if (newFiles.length <= 3) {
      highlights.push(`New files: ${newFiles.map((f) => f.path).join(', ')}`);
    } else {
      highlights.push(`${newFiles.length} new files added`);
    }
  }

  // Deleted files
  const deletedFiles = files.filter((f) => f.status === 'deleted');
  if (deletedFiles.length > 0) {
    if (deletedFiles.length <= 3) {
      highlights.push(`Removed: ${deletedFiles.map((f) => f.path).join(', ')}`);
    } else {
      highlights.push(`${deletedFiles.length} files removed`);
    }
  }

  // Largest changes
  const sorted = [...files].sort((a, b) => (b.additions + b.deletions) - (a.additions + a.deletions));
  const biggest = sorted[0];
  if (biggest && biggest.additions + biggest.deletions > 50) {
    highlights.push(`Most changed: ${biggest.path} (+${biggest.additions} −${biggest.deletions})`);
  }

  return highlights;
}

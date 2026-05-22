import type { LensFinding, LensResult, LensSeverity, ReviewReport } from './types';

/** Build a markdown report from lens results. */
export function buildReport(report: ReviewReport): string {
  const sections = [
    `# Code Review — ${report.generatedAt}`,
    '',
    buildChangesSection(report.diffStat),
    buildScoreboard(report.lenses),
    ...report.lenses.map(buildLensSection),
  ];

  return sections.join('\n');
}

function buildChangesSection(diffStat: string): string {
  return ['## Changes', '', '```', diffStat, '```', ''].join('\n');
}

function buildScoreboard(lenses: LensResult[]): string {
  const counts = countFindings(lenses);
  return [
    '## Scoreboard',
    '',
    '| Metric | Count |',
    '| --- | --- |',
    `| **Total findings** | **${counts.total}** |`,
    `| 🔴 Blockers | ${counts.blocker} |`,
    `| 🟡 Warnings | ${counts.warning} |`,
    `| 🔵 Notes | ${counts.note} |`,
    `| Lenses applied | ${lenses.length} |`,
    '',
  ].join('\n');
}

function countFindings(lenses: LensResult[]): Record<LensSeverity | 'total', number> {
  const counts = { blocker: 0, warning: 0, note: 0, total: 0 };
  for (const lens of lenses) {
    for (const f of lens.findings) {
      counts[f.severity]++;
      counts.total++;
    }
  }
  return counts;
}

function buildLensSection(lens: LensResult): string {
  const lines: string[] = [`## ${lens.lens}`, ''];

  if (lens.findings.length === 0) {
    lines.push('No findings. ✓', '');
    if (lens.summary) lines.push(lens.summary, '');
    return lines.join('\n');
  }

  lines.push(buildFindingsByGroup(lens.findings));

  if (lens.summary) {
    lines.push(`**Summary:** ${lens.summary}`, '');
  }

  if (lens.toolOutputs && Object.keys(lens.toolOutputs).length > 0) {
    lines.push(buildToolOutputDetails(lens.toolOutputs));
  }

  return lines.join('\n');
}

const SEVERITY_ICONS: Record<LensSeverity, string> = {
  blocker: '🔴',
  warning: '🟡',
  note: '🔵',
};

function buildFindingsByGroup(findings: LensFinding[]): string {
  const lines: string[] = [];
  const severities: LensSeverity[] = ['blocker', 'warning', 'note'];

  for (const severity of severities) {
    const group = findings.filter((f) => f.severity === severity);
    if (group.length === 0) continue;

    const label = severity.charAt(0).toUpperCase() + severity.slice(1);
    lines.push(`### ${SEVERITY_ICONS[severity]} ${label}s (${group.length})`, '');

    for (const f of group) {
      const loc = f.line ? `${f.file}:${f.line}` : f.file;
      lines.push(`- \`${loc}\` — ${f.message}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function buildToolOutputDetails(toolOutputs: Record<string, string>): string {
  const lines = [
    '<details>',
    `<summary>Tool outputs (${Object.keys(toolOutputs).length})</summary>`,
    '',
  ];

  for (const [cmd, output] of Object.entries(toolOutputs)) {
    lines.push(`**\`${cmd}\`**`, '```', output.slice(0, 5000), '```');
  }

  lines.push('</details>', '');
  return lines.join('\n');
}

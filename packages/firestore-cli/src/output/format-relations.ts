import type { RelationMap } from '../commands/relations-infer.js';

export function formatRelationMap(map: RelationMap): string {
  if (map.collections.length === 0) {
    return 'No collections found for relation mapping.';
  }

  const lines: string[] = ['## Firestore Relation Map', '', '### Collections'];
  for (const col of map.collections) {
    const fields =
      col.sampleFields.length > 0
        ? ` — fields: ${col.sampleFields.map((f) => `\`${f}\``).join(', ')}`
        : '';
    const count = col.documentCount !== undefined ? ` (${col.documentCount} docs)` : '';
    lines.push(`- **${col.id}**${count}${fields}`);
  }
  lines.push('');

  if (map.relationships.length === 0) {
    lines.push('### Relationships', 'No relationships detected.');
  } else {
    lines.push('### Relationships');
    for (const rel of map.relationships) {
      const icon = rel.confidence === 'high' ? 'high' : rel.confidence === 'medium' ? 'med' : 'low';
      lines.push(
        `- [${icon}] **${rel.from}** → **${rel.to}** (${rel.type}, confidence: ${rel.confidence})`,
      );
      for (const ev of rel.evidence) lines.push(`  - ${ev}`);
    }
  }

  return lines.join('\n');
}

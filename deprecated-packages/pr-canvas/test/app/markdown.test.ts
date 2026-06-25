import { describe, expect, it } from 'bun:test';
import { parseMarkdownBlocks, renderMarkdown } from '../../app/src/lib/markdown';

describe('parseMarkdownBlocks', () => {
  it('extracts Mermaid fenced blocks from markdown', () => {
    const blocks = parseMarkdownBlocks(`Intro

\`\`\`mermaid
sequenceDiagram
  A->>B: hi
\`\`\`

Outro`);

    expect(blocks).toEqual([
      { type: 'markdown', source: 'Intro\n\n' },
      { type: 'mermaid', source: 'sequenceDiagram\n  A->>B: hi\n' },
      { type: 'markdown', source: '\n\nOutro' },
    ]);
  });

  it('recognizes Mermaid fences with extra info text', () => {
    const blocks = parseMarkdownBlocks(`\`\`\`mermaid title="Flow"
flowchart TD
  A --> B
\`\`\``);

    expect(blocks).toEqual([{ type: 'mermaid', source: 'flowchart TD\n  A --> B\n' }]);
  });

  it('keeps non-Mermaid code fences inside markdown chunks', () => {
    const source = `Before

\`\`\`ts
const x = 1;
\`\`\``;
    const blocks = parseMarkdownBlocks(source);

    expect(blocks).toEqual([{ type: 'markdown', source }]);
    expect(renderMarkdown(blocks[0]!.source)).toContain('class="language-ts"');
    expect(renderMarkdown(blocks[0]!.source)).toContain('const x = 1;');
  });

  it('returns one markdown block when no Mermaid is present', () => {
    expect(parseMarkdownBlocks('hello **world**')).toEqual([
      { type: 'markdown', source: 'hello **world**' },
    ]);
  });
});

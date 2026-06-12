import { describe, expect, it } from 'bun:test';
import {
  proposeSplit,
  renderProposal,
  shouldRecommendSplit,
} from '../extensions/stacked-prs/split/analyzer';
import { renderStack } from '../extensions/stacked-prs/stack/render';
import { parseStackTree } from '../extensions/stacked-prs/stack/parser';

describe('proposeSplit', () => {
  it('orders layers foundational -> surface and drops empty buckets', () => {
    const layers = proposeSplit([
      { path: 'src/components/Button.tsx' },
      { path: 'db/migrations/001_init.sql' },
      { path: 'server/services/user.ts' },
    ]);
    expect(layers.map((l) => l.branch)).toEqual([
      'layer-schema',
      'layer-backend',
      'layer-frontend',
    ]);
  });

  it('puts unmatched files in a misc layer last', () => {
    const layers = proposeSplit([{ path: 'random.config' }]);
    expect(layers).toHaveLength(1);
    expect(layers[0]!.branch).toBe('layer-misc');
  });
});

describe('shouldRecommendSplit', () => {
  it('recommends for large multi-subsystem changes', () => {
    const files = [
      { path: 'db/schema.sql' },
      { path: 'server/services/a.ts' },
    ];
    expect(shouldRecommendSplit(files, 500).recommend).toBe(true);
  });

  it('does not recommend small single-subsystem changes', () => {
    expect(shouldRecommendSplit([{ path: 'server/a.ts' }], 30).recommend).toBe(false);
  });

  it('recommends when 3+ subsystems regardless of size', () => {
    const files = [
      { path: 'db/schema.sql' },
      { path: 'server/s.ts' },
      { path: 'components/c.tsx' },
    ];
    expect(shouldRecommendSplit(files, 50).recommend).toBe(true);
  });
});

describe('renderProposal', () => {
  it('lists branches, titles and files', () => {
    const out = renderProposal(proposeSplit([{ path: 'db/schema.sql' }]));
    expect(out).toContain('layer-schema');
    expect(out).toContain('db/schema.sql');
  });
});

describe('renderStack round-trip', () => {
  it('re-renders a parsed tree into an equivalent shape', () => {
    const input = ['● main', '└─ ● a #1', '   └─ ● b #2'].join('\n');
    const rendered = renderStack(parseStackTree(input));
    expect(rendered).toContain('● main');
    expect(rendered).toContain('● a #1');
    expect(rendered).toContain('● b #2');
  });
});

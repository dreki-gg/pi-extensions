import { describe, expect, test } from 'bun:test';
import {
  type JiraIssue,
  adfToText,
  extractIssues,
  formatComments,
  formatCommentsDigest,
  formatCommentsFull,
  formatSearchDigest,
  formatSearchFull,
  formatWorkItemDigest,
  formatWorkItemFull,
} from '../extensions/jira/format.js';

const adfDoc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'First line.' }],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Second line.' }],
    },
  ],
};

const issue: JiraIssue = {
  key: 'PROJ-7',
  fields: {
    summary: 'Login button is broken',
    issuetype: { name: 'Bug' },
    status: { name: 'In Progress' },
    priority: { name: 'High' },
    assignee: { displayName: 'Ada Lovelace' },
    reporter: { displayName: 'Alan Turing' },
    labels: ['frontend', 'regression'],
    description: adfDoc,
    comment: {
      total: 1,
      comments: [
        {
          id: '101',
          author: { displayName: 'Ada Lovelace' },
          created: '2024-01-01',
          body: 'On it.',
        },
      ],
    },
  },
};

describe('adfToText', () => {
  test('flattens an ADF document to text with line breaks', () => {
    const text = adfToText(adfDoc);
    expect(text).toContain('First line.');
    expect(text).toContain('Second line.');
  });

  test('passes a plain string through', () => {
    expect(adfToText('plain')).toBe('plain');
  });

  test('returns empty string for null', () => {
    expect(adfToText(null)).toBe('');
  });
});

describe('formatWorkItemDigest', () => {
  test('includes key, summary, status, and comment count', () => {
    const out = formatWorkItemDigest(issue, '/tmp/ticket.md');
    expect(out).toContain('PROJ-7 — Login button is broken');
    expect(out).toContain('Status: In Progress');
    expect(out).toContain('Assignee: Ada Lovelace');
    expect(out).toContain('Comments: 1');
    expect(out).toContain('/tmp/ticket.md');
  });

  test('handles missing fields gracefully', () => {
    const out = formatWorkItemDigest({ key: 'X-1' });
    expect(out).toContain('X-1');
    expect(out).toContain('(no summary)');
  });
});

describe('formatWorkItemFull', () => {
  test('renders description and comments sections', () => {
    const out = formatWorkItemFull(issue);
    expect(out).toContain('## Description');
    expect(out).toContain('First line.');
    expect(out).toContain('## Comments (1)');
    expect(out).toContain('On it.');
  });
});

describe('formatComments', () => {
  test('renders author and body', () => {
    const out = formatComments([{ author: { displayName: 'Ada' }, body: 'hello' }]);
    expect(out).toContain('Ada');
    expect(out).toContain('hello');
  });

  test('handles empty list', () => {
    expect(formatComments([])).toContain('no comments');
  });
});

describe('formatCommentsDigest', () => {
  test('shows count, recent preview, and file path', () => {
    const comments = Array.from({ length: 5 }, (_, i) => ({
      author: { displayName: `User ${i}` },
      body: `comment ${i}`,
    }));
    const out = formatCommentsDigest(comments, 'PROJ-7', '/tmp/c.md', 2);
    expect(out).toContain('PROJ-7: 5 comment(s)');
    expect(out).toContain('User 4');
    expect(out).toContain('User 3');
    expect(out).not.toContain('User 0');
    expect(out).toContain('/tmp/c.md');
  });

  test('reports no comments', () => {
    expect(formatCommentsDigest([], 'X-1')).toContain('no comments');
  });
});

describe('formatCommentsFull', () => {
  test('renders a heading and every comment body', () => {
    const out = formatCommentsFull([{ author: { displayName: 'Ada' }, body: 'first' }], 'PROJ-7');
    expect(out).toContain('# Comments — PROJ-7 (1)');
    expect(out).toContain('first');
  });
});

describe('extractIssues', () => {
  test('reads an array payload', () => {
    expect(extractIssues([{ key: 'A-1' }])).toHaveLength(1);
  });

  test('reads the issues key', () => {
    expect(extractIssues({ issues: [{ key: 'A-1' }, { key: 'A-2' }] })).toHaveLength(2);
  });

  test('returns empty for unrecognised shapes', () => {
    expect(extractIssues({ nope: true })).toEqual([]);
  });
});

describe('formatSearchDigest', () => {
  test('lists matching items', () => {
    const out = formatSearchDigest([issue]);
    expect(out).toContain('1 work item(s)');
    expect(out).toContain('PROJ-7');
    expect(out).toContain('In Progress');
  });

  test('reports no matches', () => {
    expect(formatSearchDigest([])).toContain('No matching');
  });

  test('appends the temp file path when provided', () => {
    expect(formatSearchDigest([issue], '/tmp/s.md')).toContain('/tmp/s.md');
  });
});

describe('formatSearchFull', () => {
  test('renders one full block per issue', () => {
    const out = formatSearchFull([issue]);
    expect(out).toContain('# Search results (1)');
    expect(out).toContain('## Description');
    expect(out).toContain('First line.');
  });
});

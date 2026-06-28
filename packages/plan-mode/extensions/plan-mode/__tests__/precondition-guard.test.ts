import { describe, expect, test } from 'bun:test';
import {
  detectPreconditionGaps,
  isDestructiveTaskText,
  hasPreconditionProof,
  formatPreconditionRejection,
} from '../precondition-guard.js';

describe('isDestructiveTaskText', () => {
  test('fires on destructive verb + symbol target', () => {
    expect(isDestructiveTaskText('Remove the `AuthProvider` export')).toBe(true);
    expect(isDestructiveTaskText('Delete the previewCandidatesOp operation')).toBe(true);
  });

  test('fires on destructive verb + file path', () => {
    expect(isDestructiveTaskText('Delete src/auth/middleware.ts')).toBe(true);
  });

  test('does NOT fire on destructive verb with no codebase target', () => {
    expect(isDestructiveTaskText('Remove the TODO comment')).toBe(false);
    expect(isDestructiveTaskText('Delete the temporary value we created')).toBe(false);
  });

  test('does NOT fire on non-destructive task', () => {
    expect(isDestructiveTaskText('Add a new export to the schema module')).toBe(false);
  });
});

describe('hasPreconditionProof', () => {
  test('accepts a Precondition: marker (incl. opt-out)', () => {
    expect(hasPreconditionProof('Precondition: none — never imported anywhere')).toBe(true);
  });
  test('accepts a Proof: marker', () => {
    expect(hasPreconditionProof('Proof: ran the grep, zero hits')).toBe(true);
  });
  test('accepts an actual search command', () => {
    expect(hasPreconditionProof('rg "AuthProvider" -l shows no consumers')).toBe(true);
    expect(hasPreconditionProof('ast-grep verifies no callers')).toBe(true);
  });
  test('rejects prose with no proof signal', () => {
    expect(hasPreconditionProof('this is unused so delete it')).toBe(false);
  });
});

describe('detectPreconditionGaps', () => {
  test('flags a destructive task lacking proof', () => {
    const gaps = detectPreconditionGaps([
      { id: 't-005', description: 'Delete core viewer schema', details: 'it has zero consumers' },
    ]);
    expect(gaps.map((g) => g.id)).toEqual(['t-005']);
  });

  test('passes a destructive task WITH a proof command', () => {
    const gaps = detectPreconditionGaps([
      {
        id: 't-005',
        description: 'Delete the `ViewerConfig` export',
        details: 'Proof: rg "ViewerConfig|Viewer3DConfig|ViewerSceneConfig" -l → no hits',
      },
    ]);
    expect(gaps).toHaveLength(0);
  });

  test('passes a destructive task WITH an explicit opt-out', () => {
    const gaps = detectPreconditionGaps([
      {
        id: 't-003',
        description: 'Remove the legacy preview command',
        details: 'Precondition: none — added this session, never wired to anything',
      },
    ]);
    expect(gaps).toHaveLength(0);
  });

  test('ignores non-destructive tasks entirely', () => {
    const gaps = detectPreconditionGaps([
      { id: 't-001', description: 'Add auth middleware', details: 'create src/auth/mw.ts' },
      { id: 't-002', description: 'Remove the TODO comment in README' },
    ]);
    expect(gaps).toHaveLength(0);
  });

  test('reports multiple gaps', () => {
    const gaps = detectPreconditionGaps([
      { id: 't-001', description: 'Delete src/old.ts' },
      { id: 't-002', description: 'Rename the `Foo` interface to Bar' },
    ]);
    expect(gaps.map((g) => g.id)).toEqual(['t-001', 't-002']);
  });
});

describe('formatPreconditionRejection', () => {
  test('names offending ids and the escape hatch', () => {
    const msg = formatPreconditionRejection([{ id: 't-005', matched: 'Delete' }]);
    expect(msg).toContain('t-005');
    expect(msg).toContain('Precondition: none');
    expect(msg).toContain('submit_plan again');
  });
});

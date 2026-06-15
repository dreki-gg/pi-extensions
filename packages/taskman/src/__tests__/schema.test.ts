import { describe, expect, test } from 'bun:test';
import { Either } from 'effect';
import {
  decodeExecPendingConfig,
  decodeInitiativeManifestEntry,
  decodePlanManifestEntry,
  decodeTaskMeta,
  decodeTaskRecord,
  decodeTasksLine,
} from '../schema.js';

const now = '2026-05-27T12:00:00.000Z';

const isOk = (value: unknown, decode: (v: unknown) => Either.Either<unknown, unknown>): boolean =>
  Either.isRight(decode(value));

describe('task record schema', () => {
  test('accepts a full task record', () => {
    expect(
      isOk(
        {
          _type: 'task',
          id: 't-001',
          description: 'Do work',
          details: 'Full instructions',
          status: 'pending',
          depends_on: ['t-000'],
          notes: 'note',
          created_at: now,
          updated_at: now,
        },
        decodeTaskRecord,
      ),
    ).toBe(true);
  });

  test('accepts a lightweight task record without details', () => {
    expect(
      isOk(
        {
          _type: 'task',
          id: 't-001',
          description: 'Do work',
          status: 'pending',
          created_at: now,
          updated_at: now,
        },
        decodeTaskRecord,
      ),
    ).toBe(true);
  });

  test('accepts a deferred discovered task', () => {
    expect(
      isOk(
        {
          _type: 'task',
          id: 't-011',
          description: 'Follow-up discovered mid-run',
          status: 'deferred',
          origin: 'discovered',
          notes: 'noticed while implementing',
          created_at: now,
          updated_at: now,
        },
        decodeTaskRecord,
      ),
    ).toBe(true);
  });

  test('rejects an unknown origin', () => {
    expect(
      isOk(
        {
          _type: 'task',
          id: 't-001',
          description: 'Do work',
          status: 'pending',
          origin: 'bogus',
          created_at: now,
          updated_at: now,
        },
        decodeTaskRecord,
      ),
    ).toBe(false);
  });

  test('rejects missing fields and unknown status', () => {
    expect(isOk({ _type: 'task', id: 't-001', status: 'pending' }, decodeTaskRecord)).toBe(false);
    expect(
      isOk(
        {
          _type: 'task',
          id: 't-001',
          description: 'Do work',
          status: 'unknown',
          created_at: now,
          updated_at: now,
        },
        decodeTaskRecord,
      ),
    ).toBe(false);
  });
});

describe('task meta schema', () => {
  test('accepts a valid meta record', () => {
    expect(
      isOk(
        { _type: 'meta', title: 'Refactor', plan_name: 'refactor', created_at: now },
        decodeTaskMeta,
      ),
    ).toBe(true);
  });

  test('accepts a meta record with base_commit', () => {
    expect(
      isOk(
        {
          _type: 'meta',
          title: 'Refactor',
          plan_name: 'refactor',
          created_at: now,
          base_commit: 'abc123',
        },
        decodeTaskMeta,
      ),
    ).toBe(true);
  });

  test('accepts a meta record without base_commit (back-compat)', () => {
    expect(
      isOk(
        { _type: 'meta', title: 'Refactor', plan_name: 'refactor', created_at: now },
        decodeTaskMeta,
      ),
    ).toBe(true);
  });

  test('rejects malformed meta records', () => {
    expect(isOk({ _type: 'meta', title: 'Refactor' }, decodeTaskMeta)).toBe(false);
    expect(
      isOk(
        { _type: 'task', title: 'Refactor', plan_name: 'refactor', created_at: now },
        decodeTaskMeta,
      ),
    ).toBe(false);
  });
});

describe('tasks.jsonl line schema (meta | task union)', () => {
  test('discriminates meta from task', () => {
    const meta = decodeTasksLine({ _type: 'meta', title: 'T', plan_name: 'p', created_at: now });
    const task = decodeTasksLine({
      _type: 'task',
      id: 't-001',
      description: 'Do work',
      status: 'pending',
      created_at: now,
      updated_at: now,
    });
    expect(Either.isRight(meta) && Either.getOrThrow(meta)._type).toBe('meta');
    expect(Either.isRight(task) && Either.getOrThrow(task)._type).toBe('task');
  });

  test('round-trips a deferred discovered task', () => {
    const decoded = decodeTasksLine({
      _type: 'task',
      id: 't-011',
      description: 'Follow-up',
      status: 'deferred',
      origin: 'discovered',
      created_at: now,
      updated_at: now,
    });
    expect(Either.isRight(decoded)).toBe(true);
    if (Either.isRight(decoded) && decoded.right._type === 'task') {
      expect(decoded.right.status).toBe('deferred');
      expect(decoded.right.origin).toBe('discovered');
    }
  });

  test('rejects records with an unknown _type', () => {
    expect(isOk({ _type: 'bogus' }, decodeTasksLine)).toBe(false);
  });
});

describe('plan manifest entry schema', () => {
  test('accepts a valid entry with null completed_at', () => {
    expect(
      isOk(
        {
          _type: 'plan',
          name: 'plan',
          status: 'in-progress',
          title: 'Plan',
          created_at: now,
          completed_at: null,
        },
        decodePlanManifestEntry,
      ),
    ).toBe(true);
  });

  test('accepts terminal statuses (superseded / abandoned) with a reason', () => {
    for (const status of ['done', 'superseded', 'abandoned'] as const) {
      expect(
        isOk(
          {
            _type: 'plan',
            name: 'plan',
            status,
            title: 'Plan',
            created_at: now,
            completed_at: now,
            reason: 'another plan shipped it',
          },
          decodePlanManifestEntry,
        ),
      ).toBe(true);
    }
  });

  test('rejects an invalid status', () => {
    expect(
      isOk(
        {
          _type: 'plan',
          name: 'plan',
          status: 'paused',
          title: 'Plan',
          created_at: now,
          completed_at: null,
        },
        decodePlanManifestEntry,
      ),
    ).toBe(false);
  });

  test('accepts optional initiative + plan-level depends_on (forward compat)', () => {
    expect(
      isOk(
        {
          _type: 'plan',
          name: 'auth-jwt',
          status: 'in-progress',
          title: 'Auth JWT',
          created_at: now,
          completed_at: null,
          initiative: 'auth-overhaul',
          depends_on: ['auth-schema'],
        },
        decodePlanManifestEntry,
      ),
    ).toBe(true);
  });

  test('still accepts a legacy entry without the new optional fields (back compat)', () => {
    expect(
      isOk(
        {
          _type: 'plan',
          name: 'legacy',
          status: 'done',
          title: 'Legacy',
          created_at: now,
          completed_at: now,
        },
        decodePlanManifestEntry,
      ),
    ).toBe(true);
  });
});

describe('initiative manifest entry schema', () => {
  test('accepts a valid in-progress initiative', () => {
    expect(
      isOk(
        {
          _type: 'initiative',
          name: 'auth-overhaul',
          status: 'in-progress',
          title: 'Auth Overhaul',
          created_at: now,
          completed_at: null,
        },
        decodeInitiativeManifestEntry,
      ),
    ).toBe(true);
  });

  test('accepts terminal statuses with a reason', () => {
    for (const status of ['done', 'superseded', 'abandoned'] as const) {
      expect(
        isOk(
          {
            _type: 'initiative',
            name: 'auth-overhaul',
            status,
            title: 'Auth Overhaul',
            created_at: now,
            completed_at: now,
            reason: 'shipped',
          },
          decodeInitiativeManifestEntry,
        ),
      ).toBe(true);
    }
  });

  test('rejects a plan _type masquerading as an initiative', () => {
    expect(
      isOk(
        {
          _type: 'plan',
          name: 'auth-overhaul',
          status: 'in-progress',
          title: 'Auth Overhaul',
          created_at: now,
          completed_at: null,
        },
        decodeInitiativeManifestEntry,
      ),
    ).toBe(false);
  });
});

describe('exec pending config schema', () => {
  test('accepts a valid config', () => {
    expect(
      isOk(
        { model: { provider: 'anthropic', id: 'opus' }, thinking: 'low' },
        decodeExecPendingConfig,
      ),
    ).toBe(true);
  });

  test('rejects a config missing the model id', () => {
    expect(
      isOk({ model: { provider: 'anthropic' }, thinking: 'low' }, decodeExecPendingConfig),
    ).toBe(false);
  });
});

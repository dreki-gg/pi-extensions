export const VALID_OPS = [
  '==',
  '!=',
  '<',
  '<=',
  '>',
  '>=',
  'in',
  'not-in',
  'array-contains',
  'array-contains-any',
] as const;

export type FirestoreOp = (typeof VALID_OPS)[number];

export interface WhereClause {
  field: string;
  op: FirestoreOp;
  value: unknown;
}

export interface OrderByClause {
  field: string;
  direction: 'asc' | 'desc';
}

/** Coerce a CLI string value the way agents expect: bools, numbers, JSON, else string. */
export function coerceWhereValue(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(raw)) return Number(raw);
  if (
    (raw.startsWith('[') && raw.endsWith(']')) ||
    (raw.startsWith('{') && raw.endsWith('}')) ||
    (raw.startsWith('"') && raw.endsWith('"'))
  ) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through to string
    }
  }
  return raw;
}

export function parseWhereOp(op: string): FirestoreOp {
  if (!VALID_OPS.includes(op as FirestoreOp)) {
    throw new Error(`Invalid operator "${op}". Valid operators: ${VALID_OPS.join(', ')}`);
  }
  return op as FirestoreOp;
}

/** Parse `field,op,value` (value may contain commas). */
export function parseWhereFlag(raw: string): WhereClause {
  const first = raw.indexOf(',');
  const second = first === -1 ? -1 : raw.indexOf(',', first + 1);
  if (first === -1 || second === -1) {
    throw new Error(`Invalid --where "${raw}". Expected field,op,value`);
  }
  const field = raw.slice(0, first).trim();
  const op = parseWhereOp(raw.slice(first + 1, second).trim());
  const value = coerceWhereValue(raw.slice(second + 1).trim());
  if (!field) throw new Error(`Invalid --where "${raw}". Field name is required`);
  return { field, op, value };
}

export function parseWhereFlags(raw: string[] | undefined): WhereClause[] | undefined {
  if (!raw || raw.length === 0) return undefined;
  return raw.map(parseWhereFlag);
}

/** Parse `field` or `field,asc|desc`. */
export function parseOrderByFlag(raw: string | undefined): OrderByClause | undefined {
  if (!raw) return undefined;
  const [field, dir] = raw.split(',').map((s) => s.trim());
  if (!field) throw new Error(`Invalid --order-by "${raw}". Expected field[,asc|desc]`);
  const direction = (dir ?? 'asc') as 'asc' | 'desc';
  if (direction !== 'asc' && direction !== 'desc') {
    throw new Error(`Invalid --order-by direction "${dir}". Use asc or desc`);
  }
  return { field, direction };
}

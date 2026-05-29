import { StringEnum } from '@earendil-works/pi-ai';
import { Type } from 'typebox';
import { VALID_OPS } from '../client.js';

const DIRECTION_ENUM = ['asc', 'desc'] as const;

export const TOOL_GUIDELINES = [
  'Use `firestore_list_collections` first to discover available collections before querying.',
  'Use `firestore_count` before querying large collections to understand the data volume.',
  'Use `firestore_query` with where filters to narrow down results — avoid fetching entire collections.',
  'Use `firestore_get_document` when you know the exact document path (e.g. `users/abc123`).',
  'Use `firestore_relation_map` to understand how collections relate to each other — helpful for debugging consistency issues.',
  'Use the optional `environment` parameter when the user asks for a specific Firestore environment (for example: development, staging).',
  'If `environment` is omitted, the extension uses `defaultEnvironment` from `.pi/firestore.json`.',
  "Auto-apply `defaultCollection` from the selected environment when the user doesn't specify a collection.",
  'For pagination, use `startAfter` with the `lastDocId` from a previous query result.',
];

export function environmentParam() {
  return Type.Optional(
    Type.String({
      description:
        'Configured Firestore environment name from .pi/firestore.json (e.g. "development" or "staging"). Defaults to defaultEnvironment.',
    }),
  );
}

export const listCollectionsParams = Type.Object({
  environment: environmentParam(),
  path: Type.Optional(
    Type.String({
      description:
        'Document path to list subcollections (e.g. "users/abc123"). Omit for top-level collections.',
    }),
  ),
});

export const queryParams = Type.Object({
  environment: environmentParam(),
  collection: Type.String({
    description: 'Collection path (e.g. "users" or "users/abc123/orders")',
  }),
  where: Type.Optional(
    Type.Array(
      Type.Object({
        field: Type.String({ description: 'Field name' }),
        op: StringEnum([...VALID_OPS], {
          description: 'Comparison operator',
        }),
        value: Type.Unknown({ description: 'Value to compare against' }),
      }),
      { description: 'Filter conditions' },
    ),
  ),
  orderBy: Type.Optional(
    Type.Object({
      field: Type.String({ description: 'Field to sort by' }),
      direction: StringEnum(DIRECTION_ENUM, {
        description: 'Sort direction',
      }),
    }),
  ),
  limit: Type.Optional(
    Type.Number({
      description: 'Max documents to return (1-100). Default 25.',
      minimum: 1,
      maximum: 100,
    }),
  ),
  startAfter: Type.Optional(
    Type.String({
      description:
        'Document ID to start after (for pagination). Use lastDocId from previous result.',
    }),
  ),
});

export const getDocumentParams = Type.Object({
  environment: environmentParam(),
  path: Type.String({
    description: 'Full document path (e.g. "users/abc123", "users/abc/orders/xyz")',
  }),
});

export const countParams = Type.Object({
  environment: environmentParam(),
  collection: Type.String({
    description: 'Collection path (e.g. "users")',
  }),
  where: Type.Optional(
    Type.Array(
      Type.Object({
        field: Type.String({ description: 'Field name' }),
        op: StringEnum([...VALID_OPS], {
          description: 'Comparison operator',
        }),
        value: Type.Unknown({ description: 'Value to compare against' }),
      }),
      { description: 'Filter conditions' },
    ),
  ),
});

export const relationMapParams = Type.Object({
  environment: environmentParam(),
  collections: Type.Optional(
    Type.Array(Type.String(), {
      description: 'Specific collections to analyze. Omit to analyze all top-level collections.',
    }),
  ),
});

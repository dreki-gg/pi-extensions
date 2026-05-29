import { Schema } from 'effect';

// ── GitHub CLI output schemas ──────────────────────────────────────────

export const PrAuthorSchema = Schema.Struct({
  login: Schema.String,
});

export const PrLabelSchema = Schema.Struct({
  name: Schema.String,
  color: Schema.String,
});

export const PrOverviewSchema = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  body: Schema.optionalWith(Schema.String, { default: () => '' }),
  author: PrAuthorSchema,
  state: Schema.String,
  labels: Schema.Array(PrLabelSchema),
  baseRefName: Schema.String,
  headRefName: Schema.String,
  url: Schema.String,
  additions: Schema.Number,
  deletions: Schema.Number,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type PrOverview = typeof PrOverviewSchema.Type;

export const PrReviewRequestSchema = Schema.Struct({
  login: Schema.optionalWith(Schema.String, { default: () => 'unknown' }),
});

export const PrCheckSchema = Schema.Struct({
  name: Schema.optionalWith(Schema.String, { default: () => '' }),
  state: Schema.optionalWith(Schema.String, { default: () => 'PENDING' }),
  description: Schema.optionalWith(Schema.String, { default: () => '' }),
  detailsUrl: Schema.optionalWith(Schema.String, { default: () => '' }),
});

export const PrCommentSchema = Schema.Struct({
  author: PrAuthorSchema,
  body: Schema.optionalWith(Schema.String, { default: () => '' }),
  createdAt: Schema.optionalWith(Schema.String, { default: () => '' }),
  path: Schema.optional(Schema.String),
  line: Schema.optional(Schema.Number),
});

export const PrReviewSchema = Schema.Struct({
  author: PrAuthorSchema,
  state: Schema.optionalWith(Schema.String, { default: () => 'COMMENTED' }),
  body: Schema.optionalWith(Schema.String, { default: () => '' }),
  createdAt: Schema.optionalWith(Schema.String, { default: () => '' }),
  comments: Schema.optionalWith(Schema.Array(PrCommentSchema), { default: () => [] }),
});

/** Schema for `gh pr list --json ...` output items */
export const PrListItemSchema = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  author: PrAuthorSchema,
  state: Schema.String,
  url: Schema.String,
  additions: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  deletions: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  createdAt: Schema.optionalWith(Schema.String, { default: () => '' }),
});
export type PrListItem = typeof PrListItemSchema.Type;

// ── WebSocket message schemas ──────────────────────────────────────────

export const WsMessageToServer = Schema.Union(
  Schema.Struct({ type: Schema.Literal('pr:list') }),
  Schema.Struct({ type: Schema.Literal('pr:data'), number: Schema.Number }),
  Schema.Struct({ type: Schema.Literal('pr:subscribe'), number: Schema.Number }),
  Schema.Struct({
    type: Schema.Literal('ai:chat'),
    message: Schema.String,
    prNumber: Schema.Number,
  }),
);
export type WsMessageToServer = typeof WsMessageToServer.Type;

export const WsMessageFromServer = Schema.Union(
  Schema.Struct({ type: Schema.Literal('pr:list:result'), prs: Schema.Array(PrListItemSchema) }),
  Schema.Struct({
    type: Schema.Literal('pr:data:result'),
    number: Schema.Number,
    // Data is passed as opaque JSON — validated at the boundary, not here
    data: Schema.Unknown,
    rawDiff: Schema.String,
    mindMap: Schema.Unknown,
    aiSummary: Schema.Unknown,
  }),
  Schema.Struct({ type: Schema.Literal('pr:update'), number: Schema.Number, data: Schema.Unknown }),
  Schema.Struct({ type: Schema.Literal('ai:chat:response'), message: Schema.String }),
  Schema.Struct({
    type: Schema.Literal('ai:chat:stream'),
    chunk: Schema.String,
    done: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  }),
  Schema.Struct({ type: Schema.Literal('error'), message: Schema.String }),
);
export type WsMessageFromServer = typeof WsMessageFromServer.Type;

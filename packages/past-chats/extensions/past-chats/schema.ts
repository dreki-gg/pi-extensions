import { Schema } from 'effect';

export const PastChatFolderConfigSchema = Schema.Struct({
  path: Schema.String,
  label: Schema.optional(Schema.String),
});

export const PastChatSummaryConfigSchema = Schema.Struct({
  ai: Schema.optional(Schema.Boolean),
  provider: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
});

export const PastChatsConfigSchema = Schema.Struct({
  folders: Schema.optionalWith(Schema.Array(PastChatFolderConfigSchema), { default: () => [] }),
  summary: Schema.optional(PastChatSummaryConfigSchema),
});

export type PastChatFolderConfig = Schema.Schema.Type<typeof PastChatFolderConfigSchema>;
export type PastChatSummaryConfig = Schema.Schema.Type<typeof PastChatSummaryConfigSchema>;
export type PastChatsConfig = Schema.Schema.Type<typeof PastChatsConfigSchema>;

export const PastChatCacheEntrySchema = Schema.Struct({
  path: Schema.String,
  modified: Schema.String,
  version: Schema.String,
  provider: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  summary: Schema.String,
  generatedAt: Schema.String,
});

export const PastChatCacheSchema = Schema.Struct({
  entries: Schema.optionalWith(Schema.Array(PastChatCacheEntrySchema), { default: () => [] }),
});

export type PastChatCacheEntry = Schema.Schema.Type<typeof PastChatCacheEntrySchema>;
export type PastChatCache = Schema.Schema.Type<typeof PastChatCacheSchema>;

import { Schema } from 'effect';

/**
 * Raw config shape. Field-level values intentionally remain unknown so semantic
 * validation can preserve existing, user-friendly error messages.
 */
export const RawConfigSchema = Schema.Struct({
  projectId: Schema.optionalWith(Schema.Unknown, { exact: true }),
  serviceAccountKeyPath: Schema.optionalWith(Schema.Unknown, { exact: true }),
  defaultCollection: Schema.optionalWith(Schema.Unknown, { exact: true }),
  defaultEnvironment: Schema.optionalWith(Schema.Unknown, { exact: true }),
  environments: Schema.optionalWith(Schema.Unknown, { exact: true }),
  maxSampleSize: Schema.optionalWith(Schema.Unknown, { exact: true }),
  scanPaths: Schema.optionalWith(Schema.Unknown, { exact: true }),
  scanExclude: Schema.optionalWith(Schema.Unknown, { exact: true }),
});

export type RawConfig = Schema.Schema.Type<typeof RawConfigSchema>;

export interface RawEnvironmentConfig {
  readonly projectId?: unknown;
  readonly serviceAccountKeyPath?: unknown;
  readonly defaultCollection?: unknown;
}

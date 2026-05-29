import { Data } from 'effect';

export class ConfigFileNotFound extends Data.TaggedError('ConfigFileNotFound')<{
  readonly cwd: string;
  readonly candidates: readonly string[];
}> {
  get message(): string {
    return 'No .pi/firestore.json (or .pi/firebase.json) found. Create one with at least projectId and serviceAccountKeyPath, or configure environments.';
  }
}

export class ConfigReadError extends Data.TaggedError('ConfigReadError')<{
  readonly path: string;
  readonly cause: unknown;
}> {
  get message(): string {
    return `Failed to read ${this.path}: ${causeMessage(this.cause)}`;
  }
}

export class ConfigJsonError extends Data.TaggedError('ConfigJsonError')<{
  readonly path: string;
  readonly cause?: unknown;
}> {
  get message(): string {
    return `Invalid JSON in ${this.path}`;
  }
}

export class ConfigValidationError extends Data.TaggedError('ConfigValidationError')<{
  readonly path: string;
  readonly reason: string;
}> {
  get message(): string {
    return `${this.path}: ${this.reason}`;
  }
}

export class UnknownEnvironmentError extends Data.TaggedError('UnknownEnvironmentError')<{
  readonly requested: string;
  readonly available: readonly string[];
}> {
  get message(): string {
    return `Unknown Firestore environment "${this.requested}". Available environments: ${this.available.join(', ')}`;
  }
}

export class ServiceAccountReadError extends Data.TaggedError('ServiceAccountReadError')<{
  readonly path: string;
  readonly environment: string;
  readonly cause: unknown;
}> {
  get message(): string {
    return `Failed to read service account for environment "${this.environment}" at ${this.path}: ${causeMessage(this.cause)}`;
  }
}

export class ServiceAccountJsonError extends Data.TaggedError('ServiceAccountJsonError')<{
  readonly path: string;
  readonly environment: string;
  readonly cause?: unknown;
}> {
  get message(): string {
    return `Invalid JSON in service account for environment "${this.environment}" at ${this.path}`;
  }
}

export class FirebaseAdminInitError extends Data.TaggedError('FirebaseAdminInitError')<{
  readonly environment: string;
  readonly projectId: string;
  readonly cause: unknown;
}> {
  get message(): string {
    return `Failed to initialize Firestore for environment "${this.environment}" (${this.projectId}): ${causeMessage(this.cause)}`;
  }
}

export class FirestoreOperationError extends Data.TaggedError('FirestoreOperationError')<{
  readonly operation: string;
  readonly environment?: string;
  readonly cause: unknown;
}> {
  get message(): string {
    const env = this.environment ? ` for environment "${this.environment}"` : '';
    return `Firestore ${this.operation} failed${env}: ${causeMessage(this.cause)}`;
  }
}

export class FirestorePathError extends Data.TaggedError('FirestorePathError')<{
  readonly path: string;
  readonly expected: 'collection' | 'document';
  readonly reason: string;
}> {
  get message(): string {
    return this.reason;
  }
}

export class RelationScanError extends Data.TaggedError('RelationScanError')<{
  readonly path?: string;
  readonly reason: string;
  readonly cause?: unknown;
}> {
  get message(): string {
    return this.path ? `${this.reason}: ${this.path}` : this.reason;
  }
}

export type FirestoreExtensionError =
  | ConfigFileNotFound
  | ConfigReadError
  | ConfigJsonError
  | ConfigValidationError
  | UnknownEnvironmentError
  | ServiceAccountReadError
  | ServiceAccountJsonError
  | FirebaseAdminInitError
  | FirestoreOperationError
  | FirestorePathError
  | RelationScanError;

export function causeMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  return String(cause);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(error);
}

export function errorDetails(error: unknown): Record<string, unknown> {
  if (typeof error === 'object' && error !== null && '_tag' in error) {
    const tagged = error as { _tag: string } & Record<string, unknown>;
    const details: Record<string, unknown> = { error: tagged._tag };
    for (const [key, value] of Object.entries(tagged)) {
      if (key === '_tag' || key === 'cause') continue;
      details[key] = value;
    }
    details.message = errorMessage(error);
    return details;
  }

  return { error: 'api_error', message: errorMessage(error) };
}

export function toNativeError(error: unknown): Error {
  if (error instanceof Error) return error;
  const native = new Error(errorMessage(error));
  if (typeof error === 'object' && error !== null && '_tag' in error) {
    native.name = String((error as { _tag: unknown })._tag);
  }
  return native;
}

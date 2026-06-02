/**
 * Tagged error types for the code-reviewer extension.
 *
 * Modeled with Effect's `Data.TaggedError` so failures are typed and carry
 * structured context. Helpers convert them into human-readable messages and
 * native `Error`s when an Effect crosses back into Promise-land.
 */

import { Data } from 'effect';

export class FileReadError extends Data.TaggedError('FileReadError')<{
  readonly path: string;
  readonly cause: unknown;
}> {
  get message(): string {
    return `Failed to read ${this.path}: ${causeMessage(this.cause)}`;
  }
}

export class ExecError extends Data.TaggedError('ExecError')<{
  readonly command: string;
  readonly args: readonly string[];
  readonly cause: unknown;
}> {
  get message(): string {
    const cmd = [this.command, ...this.args].join(' ');
    return `Command failed: ${cmd}: ${causeMessage(this.cause)}`;
  }
}

export class ModelError extends Data.TaggedError('ModelError')<{
  readonly stage: string;
  readonly cause: unknown;
}> {
  get message(): string {
    return `Model call failed during ${this.stage}: ${causeMessage(this.cause)}`;
  }
}

export type CodeReviewerError = FileReadError | ExecError | ModelError;

// ── Helpers ───────────────────────────────────────────────────────────────

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

/** Convert a tagged/unknown error into a native Error for Promise rejection. */
export function toNativeError(error: unknown): Error {
  if (error instanceof Error) return error;
  const native = new Error(errorMessage(error));
  if (typeof error === 'object' && error !== null && '_tag' in error) {
    native.name = String((error as { _tag: unknown })._tag);
  }
  return native;
}

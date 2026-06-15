/**
 * Tagged errors for plan-mode disk I/O and JSONL validation.
 *
 * These replace ad-hoc `throw new Error(...)` so storage programs surface
 * typed, inspectable failures. They are mapped back to user-facing strings at
 * the tool boundary via `errorMessage`.
 */

import { Data } from 'effect';

export class PlanReadError extends Data.TaggedError('PlanReadError')<{
  readonly path: string;
  readonly cause: unknown;
}> {
  get message(): string {
    return `Failed to read ${this.path}: ${causeMessage(this.cause)}`;
  }
}

export class PlanWriteError extends Data.TaggedError('PlanWriteError')<{
  readonly path: string;
  readonly cause: unknown;
}> {
  get message(): string {
    return `Failed to write ${this.path}: ${causeMessage(this.cause)}`;
  }
}

export class JsonlParseError extends Data.TaggedError('JsonlParseError')<{
  readonly path: string;
  readonly line: number;
  readonly cause?: unknown;
}> {
  get message(): string {
    return `Invalid JSONL in ${this.path} at line ${this.line}: ${causeMessage(this.cause)}`;
  }
}

export class JsonlValidationError extends Data.TaggedError('JsonlValidationError')<{
  readonly path: string;
  readonly line: number;
  readonly reason: string;
}> {
  get message(): string {
    return `Invalid record in ${this.path} at line ${this.line}: ${this.reason}`;
  }
}

export class MissingMetaRecord extends Data.TaggedError('MissingMetaRecord')<{
  readonly path: string;
}> {
  get message(): string {
    return `${this.path} is missing meta record`;
  }
}

export class TaskNotFound extends Data.TaggedError('TaskNotFound')<{
  readonly planDir: string;
  readonly taskId: string;
}> {
  get message(): string {
    return `Task not found: ${this.taskId}`;
  }
}

export class TasksFileNotFound extends Data.TaggedError('TasksFileNotFound')<{
  readonly planDir: string;
}> {
  get message(): string {
    return `No tasks.jsonl found in ${this.planDir}`;
  }
}

export type PlanStorageError =
  | PlanReadError
  | PlanWriteError
  | JsonlParseError
  | JsonlValidationError
  | MissingMetaRecord
  | TaskNotFound
  | TasksFileNotFound;

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

/** Convert any error (including tagged errors) into a native Error for the tool boundary. */
export function toNativeError(error: unknown): Error {
  if (error instanceof Error) return error;
  const native = new Error(errorMessage(error));
  if (typeof error === 'object' && error !== null && '_tag' in error) {
    native.name = String((error as { _tag: unknown })._tag);
  }
  return native;
}

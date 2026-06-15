/**
 * Process-wide keyed mutex for serializing read-modify-write on shared files.
 *
 * Pi runs every tool call in a single Node process. When several tool calls run
 * in one block (e.g. three `submit_initiative` calls, or concurrent
 * `submit_plan` / `revise_plan`), each does an independent
 * read → modify → write against the same registry file. Without serialization
 * their reads all observe the same starting state and the last write clobbers
 * the rest — a classic lost-update race.
 *
 * `withFileLock` wraps a read-modify-write critical section so only one runs at
 * a time per `key` (the registry path). The semaphore is created eagerly with
 * `unsafeMakeSemaphore` and cached per key, so its permit count lives in plain
 * shared memory and serializes correctly even across independent
 * `Effect.runPromise` invocations (separate tool executes).
 *
 * NOTE: this guards against in-process concurrency only. Atomic writes
 * (`writeFileAtomic`) still protect against torn files from other processes,
 * but cross-process registry coordination is out of scope.
 */

import { Effect } from 'effect';

const locks = new Map<string, Effect.Semaphore>();

function lockFor(key: string): Effect.Semaphore {
  let lock = locks.get(key);
  if (!lock) {
    lock = Effect.unsafeMakeSemaphore(1);
    locks.set(key, lock);
  }
  return lock;
}

/**
 * Run `effect` while holding the single permit for `key`. Concurrent callers
 * with the same key queue and run one at a time; the permit is always released,
 * even on failure or interruption.
 *
 * Do NOT nest `withFileLock` for the same key inside another — the permit is
 * not reentrant and would deadlock. Express composite read-modify-write as one
 * locked section instead.
 */
export function withFileLock<A, E, R>(
  key: string,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> {
  return Effect.suspend(() => lockFor(key).withPermits(1)(effect));
}

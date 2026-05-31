import { Effect } from 'effect';
import { createWriteStream } from 'node:fs';
import { open, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PlanWriteError } from '../errors.js';

export interface AtomicWriteOptions {
  /** Test seam: file mode for the temporary file. */
  mode?: number;
}

/**
 * Atomically write `data` to `path`: write to a temp file, fsync, rename into
 * place, then best-effort fsync the directory. Failures surface as
 * `PlanWriteError`.
 */
export function writeFileAtomic(
  path: string,
  data: string | Buffer,
  options: AtomicWriteOptions = {},
): Effect.Effect<void, PlanWriteError> {
  return Effect.tryPromise({
    try: () => writeFileAtomicPromise(path, data, options),
    catch: (cause) => new PlanWriteError({ path, cause }),
  });
}

async function writeFileAtomicPromise(
  path: string,
  data: string | Buffer,
  options: AtomicWriteOptions,
): Promise<void> {
  const dir = dirname(path);
  const tempPath = join(dir, `.${process.pid}.${randomUUID()}.tmp`);
  let completed = false;

  try {
    await writeAndSync(tempPath, data, options.mode);
    await rename(tempPath, path);
    completed = true;
    await syncDirectory(dir);
  } finally {
    if (!completed) {
      await rm(tempPath, { force: true }).catch(() => undefined);
    }
  }
}

async function writeAndSync(path: string, data: string | Buffer, mode?: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(path, { flags: 'wx', mode });
    stream.once('error', reject);
    stream.once('finish', resolve);
    stream.end(data);
  });

  const handle = await open(path, 'r+');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncDirectory(dir: string): Promise<void> {
  // Directory fsync is best-effort: supported on Unix, not always elsewhere.
  const handle = await open(dir, 'r').catch(() => undefined);
  if (!handle) return;
  try {
    await handle.sync().catch(() => undefined);
  } finally {
    await handle.close().catch(() => undefined);
  }
}

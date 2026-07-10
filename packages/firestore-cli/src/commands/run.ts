import { createFirestore } from '../auth/admin.js';
import { resolveAuth } from '../auth/resolve.js';
import { formatConfigError, ConfigError } from '../config/index.js';

export interface GlobalOpts {
  env?: string;
}

export async function withFirestore<T>(
  opts: GlobalOpts,
  fn: (
    db: Awaited<ReturnType<typeof createFirestore>>,
    auth: ReturnType<typeof resolveAuth>,
  ) => Promise<T>,
): Promise<T> {
  const cwd = process.cwd();
  const auth = resolveAuth(cwd, opts.env);
  const db = await createFirestore(auth);
  return fn(db, auth);
}

export function printCliError(err: unknown): never {
  if (err instanceof ConfigError) {
    process.stderr.write(`${formatConfigError(err)}\n`);
    process.exit(1);
  }
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

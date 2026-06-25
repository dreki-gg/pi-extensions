import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Loads a project-root `.env` file into `process.env`.
 *
 * Primary path uses Node's built-in `process.loadEnvFile` (Node >= 20.12).
 * When that API is unavailable (older Node, or non-Node runtimes such as the
 * Bun test runner) it falls back to a minimal inline parser with identical
 * precedence semantics.
 *
 * Precedence follows the dotenv convention: variables already present in the
 * environment (e.g. exported by the shell) take precedence over `.env` values;
 * the file only fills in the gaps.
 *
 * Returns `true` if a `.env` file was found and loaded, `false` if none exists.
 * A missing file or any read/parse error is swallowed so a malformed `.env`
 * never breaks the extension.
 */
export function loadDotEnv(cwd: string): boolean {
  const envPath = join(cwd, '.env');

  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(envPath);
      return true;
    } catch (err: unknown) {
      if (isENOENT(err)) return false;
      return false;
    }
  }

  return loadDotEnvFallback(envPath);
}

function loadDotEnvFallback(envPath: string): boolean {
  let raw: string;
  try {
    raw = readFileSync(envPath, 'utf-8');
  } catch (err: unknown) {
    return isENOENT(err) ? false : false;
  }

  for (const parsed of parseDotEnv(raw)) {
    // Existing env wins — only fill in unset keys.
    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
  return true;
}

function parseDotEnv(raw: string): Array<{ key: string; value: string }> {
  const result: Array<{ key: string; value: string }> = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const withoutExport = trimmed.startsWith('export ') ? trimmed.slice('export '.length) : trimmed;

    const eq = withoutExport.indexOf('=');
    if (eq === -1) continue;

    const key = withoutExport.slice(0, eq).trim();
    if (!key) continue;

    let value = withoutExport.slice(eq + 1).trim();
    // Strip matching surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result.push({ key, value });
  }

  return result;
}

function isENOENT(err: unknown): boolean {
  return err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT';
}

import { buildProgram } from './cli.js';
import { ConfigError, formatConfigError } from './config/index.js';

export async function main(argv: string[] = process.argv): Promise<void> {
  try {
    await buildProgram().parseAsync(argv);
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`${formatConfigError(err)}\n`);
      process.exitCode = 1;
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

void main();

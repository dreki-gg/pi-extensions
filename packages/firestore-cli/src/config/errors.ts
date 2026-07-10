export class ConfigError extends Error {
  readonly lookedUp: readonly string[];

  constructor(message: string, lookedUp: readonly string[] = []) {
    super(message);
    this.name = 'ConfigError';
    this.lookedUp = lookedUp;
  }
}

export function formatConfigError(err: ConfigError): string {
  const lines = [err.message];
  if (err.lookedUp.length > 0) {
    lines.push('Looked for config at:');
    for (const path of err.lookedUp) {
      lines.push(`  - ${path}`);
    }
  }
  return lines.join('\n');
}

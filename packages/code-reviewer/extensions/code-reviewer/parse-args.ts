/** Parse /review command arguments into structured options. */
export function parseReviewArgs(args: string): {
  lenses: string[];
  base?: string;
  staged: boolean;
} {
  const lenses: string[] = [];
  let base: string | undefined;
  let staged = false;

  const parts = args.split(/\s+/).filter(Boolean);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === '--lens' && i + 1 < parts.length) {
      lenses.push(...parts[++i].split(','));
    } else if (part === '--base' && i + 1 < parts.length) {
      base = parts[++i];
    } else if (part === '--staged') {
      staged = true;
    }
  }

  return { lenses, base, staged };
}

export type SnapshotRef = {
  name?: string;
  role?: string;
};

export type SnapshotRefEntry = [string, SnapshotRef];

export type ResolveTargetDeps = {
  /** Fetch the trimmed visible text for a ref, or null when unavailable. */
  getVisibleText: (refId: string) => Promise<string | null>;
};

/**
 * Resolve a unique interactive ref id (prefixed with `@`) for the given text.
 *
 * Matching is tiered, strictest first, and each tier only accepts a result when
 * it is unambiguous (exactly one match). Exact tiers run before fuzzy tiers so a
 * precise label is never overridden by a looser substring hit:
 *
 *  1. exact accessible name
 *  2. exact visible text
 *  3. case-insensitive substring on accessible name
 *  4. case-insensitive substring on visible text
 *
 * When a tier produces multiple matches we throw an ambiguity error (rather than
 * guessing) so the caller can disambiguate with a `selector`.
 */
export async function resolveTargetRef(
  rawText: string,
  refs: SnapshotRefEntry[],
  deps: ResolveTargetDeps,
): Promise<string> {
  const targetText = rawText.trim();

  // Tier 1: exact accessible name.
  const exactName = refs.filter(([, ref]) => ref.name?.trim() === targetText);
  const exactNameMatch = pickSingleMatch(exactName);
  if (exactNameMatch) {
    return exactNameMatch;
  }

  // Tier 2: exact visible text. Narrow to the exact-name pool when several refs
  // share the name, otherwise scan everything.
  const exactVisible = await filterByVisibleText(
    exactName.length > 0 ? exactName : refs,
    deps.getVisibleText,
    (text) => text === targetText,
  );
  const exactVisibleMatch = pickSingleMatch(exactVisible);
  if (exactVisibleMatch) {
    return exactVisibleMatch;
  }

  if (exactName.length > 1) {
    throwAmbiguousMatch(exactName, targetText, 'accessible name');
  }
  if (exactVisible.length > 1) {
    throwAmbiguousMatch(exactVisible, targetText, 'visible text');
  }

  // Tier 3: case-insensitive substring on accessible name.
  const needle = targetText.toLowerCase();
  const substringName = refs.filter(([, ref]) => {
    const name = ref.name?.trim().toLowerCase();
    return name ? name.includes(needle) : false;
  });
  const substringNameMatch = pickSingleMatch(substringName);
  if (substringNameMatch) {
    return substringNameMatch;
  }

  // Tier 4: case-insensitive substring on visible text.
  const substringVisible = await filterByVisibleText(
    substringName.length > 0 ? substringName : refs,
    deps.getVisibleText,
    (text) => text.toLowerCase().includes(needle),
  );
  const substringVisibleMatch = pickSingleMatch(substringVisible);
  if (substringVisibleMatch) {
    return substringVisibleMatch;
  }

  if (substringName.length > 1) {
    throwAmbiguousMatch(substringName, targetText, 'accessible name');
  }
  if (substringVisible.length > 1) {
    throwAmbiguousMatch(substringVisible, targetText, 'visible text');
  }

  throw new Error(
    `Could not resolve a unique interactive element for text: ${rawText}. Try using selector instead.`,
  );
}

async function filterByVisibleText(
  refs: SnapshotRefEntry[],
  getVisibleText: (refId: string) => Promise<string | null>,
  predicate: (text: string) => boolean,
): Promise<SnapshotRefEntry[]> {
  const results = await Promise.all(
    refs.map(async ([refId, ref]) => {
      const text = await getVisibleText(refId);
      return text !== null && predicate(text) ? ([refId, ref] as SnapshotRefEntry) : null;
    }),
  );

  return results.filter((entry): entry is SnapshotRefEntry => entry !== null);
}

function pickSingleMatch(matches: SnapshotRefEntry[]): string | null {
  return matches.length === 1 ? `@${matches[0][0]}` : null;
}

function throwAmbiguousMatch(
  matches: SnapshotRefEntry[],
  targetText: string,
  matchType: 'accessible name' | 'visible text',
): never {
  const descriptions = matches.map(([refId, ref]) => formatRefDescription(refId, ref));
  throw new Error(
    [
      `Found multiple matches for text "${targetText}" by ${matchType}.`,
      `Matches: ${descriptions.join(', ')}`,
      'Use selector instead to disambiguate.',
    ].join(' '),
  );
}

function formatRefDescription(refId: string, ref: SnapshotRef): string {
  const role = ref.role?.trim() || 'element';
  const name = ref.name?.trim() || '(unnamed)';
  return `@${refId} (${role}: ${JSON.stringify(name)})`;
}

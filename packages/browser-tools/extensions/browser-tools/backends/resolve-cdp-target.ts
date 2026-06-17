const SCHEME_PREFIX = /^(?:wss?|https?):\/\//iu;
const BARE_PORT = /^\d+$/u;

type CdpEnv = {
  PI_BROWSER_CDP?: string;
};

/**
 * Resolve and normalize a CDP connect target for the agent-browser CLI.
 *
 * Resolution order: an explicit (non-empty) `param` wins, otherwise fall back
 * to the `PI_BROWSER_CDP` env var. Returns `null` when neither is set, which
 * means "launch our own browser as usual".
 *
 * Normalization of the chosen value:
 * - bare port (`9222`)            → passed through (agent-browser maps to localhost)
 * - ws/wss/http/https URL         → passed through
 * - `host:port` without a scheme  → prefixed with `http://`
 */
export function resolveCdpTarget(param: string | undefined, env: CdpEnv): string | null {
  const chosen = firstNonEmpty(param, env.PI_BROWSER_CDP);
  if (chosen === null) {
    return null;
  }

  if (BARE_PORT.test(chosen) || SCHEME_PREFIX.test(chosen)) {
    return chosen;
  }

  return `http://${chosen}`;
}

function firstNonEmpty(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}

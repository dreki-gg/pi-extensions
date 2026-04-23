import { parseHTML } from 'linkedom';

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type WebSearchOptions = {
  allowed_domains?: string[];
  blocked_domains?: string[];
  signal?: AbortSignal;
};

const USER_AGENT = 'pi-browser-tools/1.0';
const FETCH_TIMEOUT_MS = 15_000;
const MAX_RESULTS = 10;
const env =
  (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

function getFetchSignal(signal?: AbortSignal): AbortSignal {
  return signal
    ? AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)])
    : AbortSignal.timeout(FETCH_TIMEOUT_MS);
}

function normalizeUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function matchesDomain(hostname: string, domain: string): boolean {
  const normalizedHost = hostname.toLowerCase();
  const normalizedDomain = domain.toLowerCase();
  return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
}

function filterResults(results: SearchResult[], options: WebSearchOptions): SearchResult[] {
  const seen = new Set<string>();
  const allowed = (options.allowed_domains ?? []).map((domain) => domain.toLowerCase());
  const blocked = (options.blocked_domains ?? []).map((domain) => domain.toLowerCase());

  const filtered: SearchResult[] = [];

  for (const result of results) {
    const normalizedUrl = normalizeUrl(result.url);
    if (!normalizedUrl || seen.has(normalizedUrl)) continue;

    let hostname: string;
    try {
      hostname = new URL(normalizedUrl).hostname;
    } catch {
      continue;
    }

    if (blocked.some((domain) => matchesDomain(hostname, domain))) continue;
    if (allowed.length > 0 && !allowed.some((domain) => matchesDomain(hostname, domain))) continue;

    seen.add(normalizedUrl);
    filtered.push({
      title: result.title.trim(),
      url: normalizedUrl,
      snippet: result.snippet.trim(),
    });

    if (filtered.length >= MAX_RESULTS) break;
  }

  return filtered;
}

function decodeDuckDuckGoUrl(href: string): string | null {
  try {
    const url = new URL(href, 'https://html.duckduckgo.com');
    const uddg = url.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
    return url.toString();
  } catch {
    return null;
  }
}

async function searchDuckDuckGo(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    signal: getFetchSignal(signal),
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const { document } = parseHTML(html);
  const anchors = Array.from(document.querySelectorAll('a.result__a'));

  return anchors
    .map((anchor) => {
      const title = anchor.textContent?.trim() ?? '';
      const href = anchor.getAttribute('href') ?? '';
      const resultRoot =
        anchor.closest('.result') ?? anchor.parentElement?.parentElement ?? anchor.parentElement;
      const snippet = resultRoot?.querySelector('.result__snippet')?.textContent?.trim() ?? '';
      return {
        title,
        url: decodeDuckDuckGoUrl(href) ?? href,
        snippet,
      };
    })
    .filter((result) => Boolean(result.title && result.url));
}

async function searchGoogle(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const apiKey = env.GOOGLE_CSE_API_KEY;
  const cseId = env.GOOGLE_CSE_ID;

  if (!apiKey || !cseId) {
    throw new Error('Google search requires GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID');
  }

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', cseId);
  url.searchParams.set('q', query);

  const response = await fetch(url, {
    method: 'GET',
    signal: getFetchSignal(signal),
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Google search failed: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as {
    items?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  return (json.items ?? [])
    .map((item) => ({
      title: item.title ?? '',
      url: item.link ?? '',
      snippet: item.snippet ?? '',
    }))
    .filter((result) => Boolean(result.title && result.url));
}

async function searchBrave(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const apiKey = env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    throw new Error('Brave search requires BRAVE_SEARCH_API_KEY');
  }

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);

  const response = await fetch(url, {
    method: 'GET',
    signal: getFetchSignal(signal),
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/json',
      'x-subscription-token': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave search failed: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as {
    web?: {
      results?: Array<{ title?: string; url?: string; description?: string }>;
    };
  };

  return (json.web?.results ?? [])
    .map((item) => ({
      title: item.title ?? '',
      url: item.url ?? '',
      snippet: item.description ?? '',
    }))
    .filter((result) => Boolean(result.title && result.url));
}

export async function webSearch(
  query: string,
  options: WebSearchOptions = {},
): Promise<{ results: SearchResult[] }> {
  const provider = (env.WEB_SEARCH_PROVIDER ?? 'duckduckgo').toLowerCase();

  const rawResults =
    provider === 'google'
      ? await searchGoogle(query, options.signal)
      : provider === 'brave'
        ? await searchBrave(query, options.signal)
        : await searchDuckDuckGo(query, options.signal);

  return {
    results: filterResults(rawResults, options),
  };
}

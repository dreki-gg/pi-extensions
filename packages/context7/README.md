# @dreki-gg/pi-context7

Pi-native Context7 documentation tools. Bypasses MCP entirely — direct HTTP to Context7 API with persistent searchable cache.

## Install

```bash
pi install npm:@dreki-gg/pi-context7
```

## Tools

| Tool | Description |
|------|-------------|
| `context7_resolve_library_id` | Resolve a library/package name to a Context7 library ID |
| `context7_get_library_docs` | Fetch curated docs by ID or name (auto-resolves) |
| `context7_get_cached_doc_raw` | Read full raw cached docs by docRef or semantic lookup |

Compatibility aliases: `resolve-library-id`, `get-library-docs`, `query-docs`

## Configuration

Set env var (preferred):

```bash
export CONTEXT7_API_KEY=ctx7sk-...
```

Or create `~/.pi/agent/extensions/context7/config.json`:

```json
{
  "apiKey": "ctx7sk-...",
  "cache": {
    "resolveTtlHours": 168,
    "docsTtlHours": 24
  }
}
```

API key is optional — Context7 works without one but with lower rate limits.

## Cache

Stored under `~/.pi/agent/extensions/context7/cache/` with:
- Atomic JSON writes
- Structured indexes (by library name, version, ID, docRef)
- TTL-based expiry with stale fallback
- Automatic pruning of expired/orphaned entries

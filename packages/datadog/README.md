# @dreki-gg/pi-datadog

Datadog log search tools for [pi](https://github.com/earendil-works/pi) — query production logs with project-aware context.

## Setup

### 1. Install

```bash
pi install npm:@dreki-gg/pi-datadog
```

### 2. Set credentials

Export your Datadog API and Application keys as environment variables:

```bash
export DD_API_KEY="your-datadog-api-key"
export DD_APP_KEY="your-datadog-app-key"
```

> **Tip:** Add these to your shell profile (`~/.zshrc`, `~/.bashrc`) or use a `.env` manager. Never commit credentials to version control.

You need an **Application Key** (not just an API key) because log search uses Datadog's read endpoints.

### 3. Configure your project (optional)

Create `.pi/datadog.json` in your project root to set defaults:

```json
{
  "service": "my-api",
  "env": "production",
  "site": "datadoghq.com",
  "defaultTags": ["team:backend"],
  "defaultTimeRange": "1h"
}
```

| Field | Description | Default |
|-------|-------------|---------|
| `service` | Default service name for queries | _(none)_ |
| `env` | Default environment | _(none)_ |
| `site` | Datadog site | `datadoghq.com` |
| `defaultTags` | Tags auto-appended to every query | `[]` |
| `defaultTimeRange` | Default lookback window | `1h` |

**Supported sites:** `datadoghq.com` (US1), `us3.datadoghq.com`, `us5.datadoghq.com`, `datadoghq.eu` (EU).

## Usage

### Natural language

Just ask pi to search your logs:

```
> Show me the errors in production from the last 30 minutes
> What's causing the 500 errors on the payments service?
> Find logs with "timeout" in staging from the past 24 hours
```

The agent uses your `.pi/datadog.json` defaults automatically — you don't need to specify service or environment unless you want to override them.

### Tool: `datadog_logs_search`

The agent calls this tool with [Datadog query syntax](https://docs.datadoghq.com/logs/explorer/search_syntax/):

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | `string` | **Required.** Datadog log query (e.g. `status:error`, `@http.status_code:500`) |
| `from` | `string` | Start time — relative (`15m`, `1h`, `7d`) or ISO 8601 |
| `to` | `string` | End time — relative, ISO 8601, or `now` |
| `limit` | `number` | Max results (1–100, default 25) |
| `sort` | `string` | `newest` or `oldest` |
| `service` | `string` | Override project default service |
| `env` | `string` | Override project default environment |

### Command: `/datadog`

Check your configuration and connection status:

```
/datadog
```

Shows: credential status (set/missing), project config (service, env, site, tags).

## Query Syntax Examples

```
status:error                          # All errors
service:my-api status:error           # Errors for a specific service
@http.status_code:500                 # 500 errors
"connection refused"                  # Full-text search
service:my-api env:production @duration:>5000  # Slow requests
```

See the [Datadog Log Search Syntax docs](https://docs.datadoghq.com/logs/explorer/search_syntax/) for the full reference.

## How It Works

1. The extension loads `.pi/datadog.json` from your project on session start
2. When the agent calls `datadog_logs_search`, it merges your query with project defaults (service, env, tags)
3. Results are formatted as markdown with status icons, truncated messages, and key attributes
4. The agent receives structured metadata (status breakdown, services found) to summarize intelligently

## License

MIT

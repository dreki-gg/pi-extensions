# @dreki-gg/pi-firestore

Firestore debugging tools for [pi](https://github.com/earendil-works/pi) — query collections, inspect documents, and map data relationships.

## Setup

### 1. Install

```bash
pi install npm:@dreki-gg/pi-firestore
```

### 2. Create a service account

1. Go to the [Firebase Console](https://console.firebase.google.com/) → Project Settings → Service Accounts
2. Click **Generate new private key**
3. Save the JSON file in your project (e.g. `./service-account.json`)
4. **Add it to `.gitignore`** — never commit credentials

### 3. Configure your project

Create `.pi/firestore.json` in your project root.

Single-environment config is still supported:

```json
{
  "projectId": "my-firebase-project",
  "serviceAccountKeyPath": "./service-account.json"
}
```

For multiple Firebase/Firestore environments, use `environments` and pick a default:

```json
{
  "defaultEnvironment": "development",
  "environments": {
    "development": {
      "projectId": "my-firebase-project-dev",
      "serviceAccountKeyPath": "./service-account.dev.json",
      "defaultCollection": "users"
    },
    "staging": {
      "projectId": "my-firebase-project-staging",
      "serviceAccountKeyPath": "./service-account.staging.json"
    }
  },
  "maxSampleSize": 10,
  "scanPaths": ["src"],
  "scanExclude": ["node_modules", "dist", ".git"]
}
```

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `defaultEnvironment` | `string` | Environment used when a tool call does not specify `environment`. | First configured environment |
| `environments` | `Record<string, EnvironmentConfig>` | Named Firebase/Firestore environments. Each environment has its own project and service account. | — |
| `projectId` | `string` | **Required in single-environment config.** GCP/Firebase project ID. Falls back to `.firebaserc` default project only in single-environment config. | — |
| `serviceAccountKeyPath` | `string` | **Required in single-environment config.** Path to service account JSON (relative to project root). | — |
| `defaultCollection` | `string` | Default collection for queries. In multi-environment config this belongs inside each environment. | _(none)_ |
| `maxSampleSize` | `number` | Documents per collection to sample for relation analysis. Shared by all environments. | `10` |
| `scanPaths` | `string[]` | Directories to scan for codebase relation analysis. Shared by all environments. | `["."]` |
| `scanExclude` | `string[]` | Patterns to exclude from codebase scan. Shared by all environments. | `["node_modules", "dist", ".git"]` |

> **Tip:** If you have a `.firebaserc` file, the `projectId` is read from its `projects.default` automatically for the legacy single-environment config.

## Usage

### Natural language

Just ask pi to inspect your Firestore data:

```
> List all collections in Firestore
> Show me the users collection
> How many orders have status "pending"?
> Get the document at users/abc123
> What's the relationship between the users and orders collections?
```

### Tools

#### `firestore_list_collections`

List top-level collections or subcollections of a document.

| Parameter | Type | Description |
|-----------|------|-------------|
| `environment` | `string?` | Configured environment name (e.g. `development`, `staging`). Defaults to `defaultEnvironment`. |
| `path` | `string?` | Document path to list subcollections (e.g. `users/abc123`). Omit for top-level. |

#### `firestore_query`

Query documents with filters, ordering, and pagination.

| Parameter | Type | Description |
|-----------|------|-------------|
| `environment` | `string?` | Configured environment name. Defaults to `defaultEnvironment`. |
| `collection` | `string` | **Required.** Collection path (e.g. `users` or `users/abc/orders`) |
| `where` | `array?` | Filter conditions: `[{field, op, value}]` |
| `orderBy` | `object?` | Sort: `{field, direction}` (asc/desc) |
| `limit` | `number?` | Max results (1–100, default 25) |
| `startAfter` | `string?` | Document ID cursor for pagination |

**Supported operators:** `==`, `!=`, `<`, `<=`, `>`, `>=`, `in`, `not-in`, `array-contains`, `array-contains-any`

#### `firestore_get_document`

Get a single document by full path, including subcollection list.

| Parameter | Type | Description |
|-----------|------|-------------|
| `environment` | `string?` | Configured environment name. Defaults to `defaultEnvironment`. |
| `path` | `string` | **Required.** Full document path (e.g. `users/abc123`) |

#### `firestore_count`

Count documents in a collection with optional filters.

| Parameter | Type | Description |
|-----------|------|-------------|
| `environment` | `string?` | Configured environment name. Defaults to `defaultEnvironment`. |
| `collection` | `string` | **Required.** Collection path |
| `where` | `array?` | Filter conditions (same format as query) |

#### `firestore_relation_map`

Build a relation map between collections by scanning your codebase and analyzing document fields.

| Parameter | Type | Description |
|-----------|------|-------------|
| `environment` | `string?` | Configured environment name. Defaults to `defaultEnvironment`. |
| `collections` | `string[]?` | Specific collections to analyze. Omit for all. |

**How it works:**
1. **Codebase scan:** Searches your source files for Firestore collection/doc references (e.g. `collection('users')`, `doc('orders/xyz')`)
2. **Field analysis:** Samples documents from each collection and detects reference-like fields (e.g. `userId` → `users`, path-like values)
3. **Confidence levels:** 🟢 high (field name matches collection), 🟡 medium (co-referenced in code), 🔴 low (value-based match)

### Command: `/firestore`

Check your configuration and connection status:

```
/firestore
```

Check a specific environment:

```
/firestore staging
```

Shows: config status, available environments, selected environment, project ID, service account status, Firestore client status, top-level collections.

## Query Examples

```
# List all collections in the default environment
→ firestore_list_collections

# List all collections in staging
→ firestore_list_collections environment:"staging"

# Get orders for a specific user
→ firestore_query collection:"orders" where:[{field:"userId", op:"==", value:"abc123"}]

# Count active users
→ firestore_count collection:"users" where:[{field:"status", op:"==", value:"active"}]

# Get a specific document and its subcollections
→ firestore_get_document path:"users/abc123"

# Map all relationships
→ firestore_relation_map

# Map specific collections
→ firestore_relation_map collections:["users", "orders", "products"]
```

## How It Works

1. The extension loads `.pi/firestore.json` and initializes Firebase Admin SDK for the default environment on session start
2. When a tool call specifies `environment`, the extension initializes and reuses a separate Firebase app for that environment
3. Results are formatted as markdown with truncation to fit LLM context windows
4. The relation map combines static code analysis with live data analysis for comprehensive relationship detection

## License

MIT

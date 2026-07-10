# @dreki-gg/firestore-cli

Standalone Firestore CLI backed by `firebase-admin`. Ports the query, document, count, and relation-map capabilities from `@dreki-gg/pi-firestore` so any harness can call them without loading a pi extension.

## Install / run

```bash
npx -y @dreki-gg/firestore-cli --help
npx -y @dreki-gg/firestore-cli collections
npx -y @dreki-gg/firestore-cli query users --where status,==,active --limit 10
npx -y @dreki-gg/firestore-cli get users/abc123
npx -y @dreki-gg/firestore-cli count users --where active,==,true
npx -y @dreki-gg/firestore-cli relation-map users
```

## Config

Resolution (walks up from cwd): first `.agents/firestore.json` found. Shape:

```json
{
  "defaultEnvironment": "development",
  "environments": {
    "development": {
      "projectId": "my-project-dev",
      "serviceAccountKeyPath": "./secrets/dev-sa.json"
    }
  }
}
```

Select an environment with `--env <name>`. Fallbacks: `GOOGLE_APPLICATION_CREDENTIALS` for the service-account JSON path, and `.firebaserc` `projects.default` for `projectId` when a legacy flat config omits it.

## Output

Human-readable digests go to stdout. When the full payload is large, the complete JSON is written to a temp file and the path is printed after the digest.

# @dreki-gg/firestore-cli

## 0.3.0

### Minor Changes

- Drop legacy `.pi/firestore.json` / `.pi/firebase.json` config fallbacks — resolution is `.agents/firestore.json` only (plus `GOOGLE_APPLICATION_CREDENTIALS` and `.firebaserc` fallbacks, unchanged).

## 0.2.0

### Minor Changes

- 93cb962: New package: `@dreki-gg/firestore-cli` — standalone Firestore CLI (`collections`, `query`, `get`, `count`, `relation-map`) backed by firebase-admin, with config resolution from `.agents/firestore.json` / `.pi/firestore.json` and digest-plus-temp-file output.

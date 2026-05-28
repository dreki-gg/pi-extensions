# @dreki-gg/pi-firestore

## 0.2.4

### Patch Changes

- Fix Firebase Admin SDK crash on reload: use named app instance and delete previous before re-init.

## 0.2.3

### Patch Changes

- Support `.pi/firebase.json` as an alternative config filename (falls back after `.pi/firestore.json`).

## 0.2.2

### Patch Changes

- Fix runtime error: replace `bun` Glob import with Node.js `readdir` for compatibility with pi's jiti loader.

## 0.2.1

### Patch Changes

- Suppress deprecated dependency warnings (uuid, node-domexception) via overrides.

## 0.2.0

### Minor Changes

- Initial release of pi-firestore extension. Provides 5 tools for Firestore debugging: list collections, query documents with filters/pagination, get document by path, count documents, and build relation maps between collections using codebase scan + field analysis.

# @dreki-gg/pi-code-reviewer

## 0.3.0

### Minor Changes

- d9cbc6e: refactor(code-reviewer): adopt Effect for IO and side effects

  - Disk access (`.code-review.json`, lens markdown) and subprocess execution
    (`git` diffs, lens tools via `pi.exec`) now run as Effect programs against
    injectable `FileSystem` and `Executor` services, with `Data.TaggedError`
    types (`FileReadError`, `ExecError`), mirroring the conventions used by the
    firestore and lsp packages.
  - Each module exposes a typed `*Effect` implementation plus a Promise wrapper
    that provides the live services, so command/tool call sites stay thin.
  - Added a test suite (config, lens discovery/parsing, diff collection, lens
    review) driven entirely through service injection — no real disk or
    subprocess access required.

## 0.2.0

### Minor Changes

- [`3fe2f35`](https://github.com/dreki-gg/pi-extensions/commit/3fe2f35f8e6aa124194571e349665062d85056ef) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Show review progress in the status bar during `/review` and `code_review` tool execution. Fix output truncation in `/review` by including the diff only once instead of duplicating it per lens.

## 0.1.1

### Patch Changes

- [`7835e24`](https://github.com/dreki-gg/pi-extensions/commit/7835e24d02d14f0da00d9ebb136cf54f4cd23ecb) Thanks [@jalbarrang](https://github.com/jalbarrang)! - docs(code-reviewer): update lenses examples to better generalize and illustrate how the extension and its skills should work

# @dreki-gg/pi-context7

## 0.1.4

### Patch Changes

- [`15559e4`](https://github.com/dreki-gg/pi-extensions/commit/15559e4d3392e4b5e1779cf191a69725f029a22b) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Fix Context7 config loading to read from Pi's global extension directory (`~/.pi/agent/extensions/context7`) instead of the installed npm package directory. This restores `apiKey` detection from `config.json`, ensures authenticated requests include the Authorization header, and prevents unexpected rate limiting when a key is already configured.

## 0.1.3

### Patch Changes

- [`147eb20`](https://github.com/dreki-gg/pi-extensions/commit/147eb205ace0f842da2f2823a3a3fe163ee29ad5) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Improve compatibility with newer PI releases.

  - `@dreki-gg/pi-delegate`: limit bundled agent bootstrap work to startup/reload-compatible session starts.
  - `@dreki-gg/pi-context7`: tighten tool definitions and alias argument normalization for PI compatibility.

## 0.1.2

### Patch Changes

- [`53809f8`](https://github.com/dreki-gg/pi-extensions/commit/53809f83cdf054d1eb58c577903a1d2619a2a654) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Add repository.url to package.json for npm provenance verification

## 0.1.1

### Patch Changes

- [`b1e603c`](https://github.com/dreki-gg/pi-extensions/commit/b1e603c9dab1837eed39880c0455b553deab5cb0) Thanks [@jalbarrang](https://github.com/jalbarrang)! - init packages

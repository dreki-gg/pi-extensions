/**
 * Anti-Pattern Detector for Impeccable
 * Copyright (c) 2026 Paul Bakaus
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public API facade. Ported into @dreki-gg/pi-impeccable as the static
 * (no-browser) detection engine. The puppeteer/visual engines and the CLI
 * driver from upstream are intentionally omitted; URL/rendered checks are
 * handled by pi's native web_* tools instead.
 */

export { ANTIPATTERNS, RULE_ENGINE_SUPPORT, getAntipattern, getRulesForCategory, getRuleEngineSupport, filterByProviders } from './registry/antipatterns.mjs';
export { SAFE_TAGS, BORDER_SAFE_TAGS, OVERUSED_FONTS, GENERIC_FONTS, KNOWN_SERIF_FONTS } from './shared/constants.mjs';
export { isNeutralColor, parseRgb, relativeLuminance, contrastRatio, parseGradientColors, hasChroma, getHue, colorToHex } from './shared/color.mjs';
export { isFullPage } from './shared/page.mjs';
export {
  checkElementBorders,
  checkElementMotion,
  checkElementGlow,
  checkPageTypography,
  checkPageLayout,
  checkHtmlPatterns,
} from './rules/checks.mjs';
export { detectHtml } from './engines/static-html/detect-html.mjs';
export { detectText, extractStyleBlocks, extractCSSinJS } from './engines/regex/detect-text.mjs';
export {
  walkDir,
  SCANNABLE_EXTENSIONS,
  HTML_EXTENSIONS,
  SKIP_DIRS,
  buildImportGraph,
  resolveImport,
  detectFrameworkConfig,
  isPortListening,
  FRAMEWORK_CONFIGS,
} from './node/file-system.mjs';

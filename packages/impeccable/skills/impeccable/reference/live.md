# live — rendered iteration with pi's web tools

> **Note on this port.** Upstream impeccable ships a bundled dev-server + browser-injection "live variant" mode. `@dreki-gg/pi-impeccable` does **not** bundle that server. Rendered iteration here uses pi's native web tools instead, which cover the same need — see, drive, and verify the real page — without a custom protocol.

## When to use

Reach for rendered iteration whenever you need to judge or change a surface as the user actually sees it: visual verification after an edit, an in-browser critique pass, responsive checks, or confirming an interaction works.

## The tools

- **`web_screenshot`** — capture the surface. Use both desktop and mobile viewports for responsive work. Prefer screenshotting a running dev/static server URL over `file://`.
- **`web_visit`** — fetch readable content; pass `render: true` for JavaScript-heavy SPAs to get the rendered HTML. Save that HTML and feed the path to the `impeccable_detect` tool to run the deterministic rules against the real DOM, not just source.
- **`web_interact`** — click, type, scroll, hover, select to drive the page through states (open a menu, fill a form, reveal an error) before capturing.
- **`web_console`** — read runtime logs, warnings, and uncaught errors that affect the experience.

## A typical loop

1. Make the design change in source.
2. `web_screenshot` the surface (desktop + mobile). Read it like a design director — hierarchy, spacing, color, type, the AI-slop tells from the parent skill.
3. `web_interact` to exercise the states that matter; `web_console` to catch errors.
4. For a deterministic second opinion, `web_visit` with `render: true`, save the HTML, and run `impeccable_detect` on it.
5. Fold the findings back into the edit. Repeat until the surface is right.

## Variants

To compare design alternatives, implement each variant in source (or behind a quick toggle/branch), screenshot each, and judge them side by side. Keep the winner; discard the rest. This replaces upstream's in-browser variant hot-swap with a plain, reviewable diff.

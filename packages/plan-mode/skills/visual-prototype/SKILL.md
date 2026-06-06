---
name: visual-prototype
description: Build a visual HTML prototype during planning for UI, component, layout, or style changes, so the user can react to the design before the plan is finalized. Use when a plan touches frontend appearance or interaction. Not for backend-only or non-visual work.
---

# Visual Prototype

A prototype is a **convergence artifact**, not a deliverable. When a plan changes how something looks or behaves visually, a static markdown plan cannot show the user what they are agreeing to. Build the prototype while the plan is still soft, show it, and let the user redirect you before anything is committed to `submit_plan`.

## When to use

Use this when the plan involves any of:

- New or restyled UI components
- Layout, spacing, or visual hierarchy changes
- Color, typography, or theming changes
- Interaction states (hover, active, empty, loading, error)

Do **not** use it for backend-only, refactor-only, or otherwise non-visual work.

## Process

### 1. Decide there is something to see

If you cannot picture a screen or component changing, skip the prototype. A prototype for invisible work is noise.

### 2. Build it with `preview_prototype`

Call `preview_prototype` with:

- `title` — short name for the prototype
- `intent` — one line describing what it shows
- `html` — a complete, self-contained HTML document you author **with full freedom**. There is no template engine and no imposed theme: pick your own markup, fonts, colors, layout, and inline `<style>`/`<script>`. Assume nothing about a host page.

The tool persists your HTML to `.plans/_prototypes/<slug>.html` and opens it for review. It does not wrap, restyle, or theme your markup — what you write is what the user sees. (A bare fragment is tolerated and dropped into a minimal unstyled shell, but prefer sending a full document.)

**Avoid generic boilerplate.** A dark dashboard with a purple accent and a card is not a design — it is slop. Design something that fits the actual product. For real design taste, delegate the markup to the `ux-designer` subagent and pass its HTML straight through `preview_prototype`.

### 3. Get a reaction before submitting

Stop and ask the user what they think. Iterate on the prototype — call `preview_prototype` again with revisions — until the visual direction is agreed. Only then move toward `submit_plan`.

`submit_plan` never generates HTML. The prototype lives entirely in the planning phase; its job is done once the user has reacted.

## Relationship to context.md

The prototype is the visual sibling of `context.md`. Both are deliberation artifacts that exist to slow the jump from "read the codebase" to "submit the plan." Keep `context.md` current as the living written record of intent, decisions, and open questions; use a prototype whenever the decision is visual. Resist the urge to skip straight to `submit_plan` on visual work.

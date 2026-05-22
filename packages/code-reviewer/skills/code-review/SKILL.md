---
name: code-review
description: Multi-lens code review against working directory changes. Evaluates diffs through configurable criteria like code-quality, maintainability, product-vision, and accessibility. Use when user says "review my changes", "review this code", "check before committing", or "code review".
---

# Code Review

Review working directory changes through configurable lenses — each lens evaluates the diff against specific criteria and project tools.

## Quick start

```
/review                          # All lenses, working dir diff
/review --lens code-quality      # Single lens
/review --lens quality,ux        # Multiple lenses
/review --base main              # Diff against a branch
/review --staged                 # Only staged changes
/review-lenses                   # List available lenses
/review-init                     # Scaffold lenses for this project
```

Or use the `code_review` tool directly for programmatic access.


## Lens format

Each lens is a markdown file in `.code-review/lenses/`:

```md
# Lens Name

Description of what this lens evaluates.

## Criteria
- Evaluation point 1
- Evaluation point 2

## Tools
- `npm run typecheck`
- `npm run lint`

## Severity
- blocker: What constitutes a blocking issue
- warning: What constitutes a warning
- note: What constitutes a note
```

## Configuration

Optional `.code-review.json` at project root:

```json
{
  "lensDir": ".code-review/lenses",
  "defaultLenses": ["code-quality", "maintainability"]
}
```

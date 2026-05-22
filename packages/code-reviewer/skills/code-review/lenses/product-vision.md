# Product Vision

Evaluates whether changes fulfill the intent behind the work — traces the diff back to its originating issue, PR description, or design doc and checks alignment.

## Criteria
- Is there a linked issue, PR description, or design document that explains why this change was requested?
- Does the diff actually accomplish the stated goal, or does it drift into unrelated concerns?
- Are there parts of the requirement left unaddressed by the change?
- Does the change introduce scope creep beyond what was requested?
- Does it follow the project's domain language (check CONTEXT.md, glossary, or naming conventions)?
- Are user-facing strings consistent with the existing product vocabulary?
- If the change modifies a public API or user flow, is that justified by the original request?

## Tools

## Severity
- blocker: Change does not accomplish the stated goal, or contradicts the originating requirement
- warning: Scope creep beyond the request, unaddressed requirements, inconsistent domain language
- note: Opportunities to better align naming or structure with the stated intent

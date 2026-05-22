# Maintainability

Evaluates whether changes will be easy to understand, modify, and extend in the future.

## Criteria
- Is the code well-organized with clear separation of concerns?
- Are functions and components reasonably sized (not giant)?
- Are there clear abstractions or is logic tangled?
- Does the change increase coupling between modules?
- Would a new team member understand this code without extensive context?
- Are there magic numbers, hardcoded values, or unclear abbreviations?
- Is there adequate documentation for complex logic?
- Does the change duplicate existing patterns instead of reusing them?

## Tools

## Severity
- blocker: Introduces tight coupling across module boundaries, creates circular dependencies
- warning: Large functions (>100 lines), duplicated logic, unclear naming, missing docs on complex code
- note: Opportunities to simplify, extract, or clarify

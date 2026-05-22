# Accessibility

Evaluates UI changes for accessibility compliance — semantic markup, keyboard support, screen reader compatibility, and inclusive design patterns.

## Criteria
- Are interactive elements accessible via keyboard (tab order, Enter/Space activation, Escape to dismiss)?
- Do custom components use appropriate ARIA roles, states, and properties?
- Are images and icons accompanied by meaningful alt text or aria-label?
- Are form inputs associated with visible labels (not just placeholder text)?
- Does the change use semantic HTML elements (button, nav, main, dialog) instead of generic divs with click handlers?
- Is focus managed correctly after dynamic content changes (modals, route transitions, toast notifications)?
- Are error and validation messages announced to screen readers (aria-live, role="alert")?
- Does the color usage rely solely on color to convey meaning, or is there a secondary indicator (icon, text)?

## Tools

## Severity
- blocker: Interactive elements unreachable by keyboard, missing labels on form inputs, click handlers on non-interactive elements without ARIA roles
- warning: Missing alt text, placeholder-only labels, missing aria-live on dynamic content, focus not managed after modals
- note: Semantic HTML improvements, ARIA attribute refinements, color contrast suggestions

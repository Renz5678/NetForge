# Accessibility (a11y) Baseline

```
POLICY: Accessibility Baseline Enforcement (WCAG 2.1 AA)
Version: 1.0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. SEMANTIC HTML FIRST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use the correct HTML element before reaching for ARIA.
  BAD:  <div onClick={submit} className="btn">Submit</div>
  GOOD: <button type="submit">Submit</button>

Semantic element checklist:
  Navigation:     <nav> with aria-label if multiple nav regions exist
  Main content:   <main> — exactly one per page
  Page sections:  <section aria-labelledby="heading-id"> or <article>
  Forms:          <form> with associated <label> for every input
  Lists:          <ul>/<ol> + <li> — never use divs for visual lists
  Tables:         <table> with <thead>, <th scope="col/row">, <caption>
  Dialogs:        <dialog> or role="dialog" with aria-modal="true" and focus trap
  Interactive:    <button> for actions, <a> for navigation — never swap them

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. KEYBOARD NAVIGATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every interactive element must be reachable and operable by keyboard alone.

  - All clickable elements: must be focusable (button, a, input, or tabIndex=0)
  - Custom dropdown / menu: implement roving tabIndex pattern or use Arrow keys
  - Modals and dialogs: trap focus inside when open, return focus to trigger on close
  - Skip links: provide a "Skip to main content" link as the first focusable element

Focus style rules:
  - NEVER use outline: none without a custom :focus-visible replacement
  - GOOD: :focus-visible { outline: 2px solid var(--color-brand); outline-offset: 2px; }
  - Do not rely on :focus alone — :focus-visible avoids showing rings on mouse clicks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. ARIA USAGE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Only use ARIA when native HTML cannot convey the semantics
  - aria-label is required on icon-only buttons: <button aria-label="Close dialog">
  - aria-expanded: toggle on accordion / dropdown triggers
  - aria-live="polite": announce dynamic content changes (toast, status)
  - aria-current="page": on active navigation links
  - role="alert": for error messages that need immediate announcement
  - Never set role="presentation" on elements that convey meaning

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. COLOR CONTRAST MINIMUMS (WCAG 2.1 AA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Normal text (below 18pt / 14pt bold): contrast ratio >= 4.5:1
  Large text (18pt+ / 14pt+ bold):      contrast ratio >= 3:1
  UI components and focus indicators:   contrast ratio >= 3:1
  Decorative elements:                  no requirement

Enforce at token definition time — define color pairs and test contrast in
global CSS comments. Flag any text/background combination below threshold.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. IMAGES AND MEDIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - All meaningful images: alt="[descriptive text]"
  - Decorative images: alt="" (empty, not missing — missing alt is a violation)
  - SVG icons: aria-hidden="true" when accompanied by visible text
  - Video: provide captions or a transcript
  - Audio: provide a transcript
```

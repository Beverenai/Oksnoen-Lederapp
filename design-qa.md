# Design QA: Smooth mobile navigation

## Result

Passed. No open P0, P1, or P2 visual or interaction issues were found in the final pass.

## Reference and setup

- Reference: `/Users/august/Downloads/Screenshot 2026-07-27 at 19.57.17.png`
- Reference viewport: normalized from 943 x 2048 px to 393 x 852 px
- Implementation viewport: 393 x 852 px, light mode, Home active
- Implementation screenshot: `/tmp/oksnoen-navigation-qa/implementation-final.png`
- Full comparison: `/tmp/oksnoen-navigation-qa/full-comparison-final.png`
- Navigation comparison: `/tmp/oksnoen-navigation-qa/nav-comparison-final.png`

## Fidelity review

- Layout: floating bottom pill matches the reference's width, height, screen clearance, and safe-area placement.
- Shape and material: translucent card surface, white edge, shadow, and active capsule match the reference while using Oksnoen's existing color tokens.
- Typography and icons: stable icon and label dimensions prevent shifts; Oksnoen keeps its four product-specific tabs and Pass icon.
- Motion: the active capsule glides between tabs, route content transitions locally, and reduced-motion preferences are respected.
- Responsiveness: labels fit at 393 px without clipping or overlap, including the longer `Passkontroll` label.

## Interaction checks

- Home, Passkontroll, Ledere, and Mer all open the correct state and update `aria-current`.
- The persistent app shell does not remount between protected routes.
- Primary tab bundles preload after startup to remove first-tap delay.
- Each main tab stores and restores its own scroll position; tapping the active tab returns to the top.
- The mobile header still hides and returns based on scroll direction.
- The bottom navigation stays clear of the iPhone safe area and dynamically updates the page's bottom padding.
- A fresh browser run produced no runtime errors. Existing React Router future-version warnings remain informational.

## Iterations

1. First pass: the pill was too wide and sat too high compared with the reference. Margins and safe-area clearance were corrected.
2. Second pass: body-based scrolling in the iOS-style layout exposed inconsistent scroll tracking. Window, document, and body positions are now handled together.
3. Final pass: active contrast was increased, and a fallback page-enter animation was added for browsers without native View Transitions.

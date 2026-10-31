# Organic Sanctuary colour refactor

Published against rollback source commit `270a6f827ce75ea8bbdb25d65360998b47cabe00` (previous published version 11).

## Exact approved tokens

| Semantic token | Light | Dark |
| --- | --- | --- |
| --app-background | #F7F5F0 | #151816 |
| --surface-background | #FFFFFF | #202421 |
| --elevated-surface | #EFECE6 | #2B302C |
| --primary-text | #232623 | #FAF8F5 |
| --secondary-text | #636863 | #A3AAA3 |
| --primary-accent | #536656 | #819885 |
| --secondary-accent | #A66B56 | #D48C77 |
| --border-color | rgba(35, 38, 35, 0.08) | rgba(250, 248, 245, 0.10) |

Existing component variables now alias these semantic tokens. Removed conflicting repeated dark overrides and the previous blue/lavender/pink card overrides. Ordinary cards use the surface, while energy, hydration and editorial highlights use elevated surfaces. Existing borders and shadows keep their geometry, with warm, restrained shadow colours. Menus, portalled dialogs and mobile navigation inherit root tokens. Existing pre-paint theme selection and transitions are unchanged, including system-dark fallback.

Charts retain all labels, axes, values, filters, interactions and calculations. Their existing series variables now use sage/clay and warm sand/amber: Light #536656 / #A66B56 / #866B45 / #82672F; Dark #819885 / #D48C77 / #C6AD83 / #C7A865. The accessible primary-button ink is white in Light and #151816 in Dark. The white switch knob uses #536656 On and #636863 Off to retain contrast. Light hover sage uses #435247; Dark hover uses approved #A3AAA3. Error text uses warm clay tones. These are necessary legibility/state variations, not additional theme palettes.

## Exact files changed

- app/globals.css — colour variables, legacy alias mapping, removal of obsolete colour overrides, preservation of the opening screen colours.
- tests/studio-ui.test.cjs — replaced obsolete pastel assertions with exact approved-token and chart contrast assertions; removed dependency on the deleted duplicate dark block.
- docs/organic-sanctuary-theme.md — this report.

No React component, hook, route, state, calculation, API, data, dependency, image or animation implementation changed. Flower geometry, wordmark, flower colours, opening animation, aurora colours, canvas rendering, motion timing, hover behaviour, responsive arrangements and layout declarations are unchanged. No new runtime JavaScript or network requests were added.

## Verification

- All 52 Node regression tests passed, including programmatic renders of Home, Meals, Food, Planner, Ask Bloom, Progress, Wellness, all five Profile steps, guest/account presentation, empty/loading states, modal controls, dropdown retention, chart interaction and cycle toggles.
- Theme script tests check Light/Dark/system selection and pre-paint reload behaviour.
- Text contrast tests pass at 4.5:1 for the tested surface/ink pairs, including primary buttons, navigation and highlights. Inputs/focus rings/chart marks and white toggle knob pass 3:1. Four nutrient series additionally pass 3:1 against both ordinary and elevated surfaces in both themes.
- TypeScript no-emit check passed.
- Existing production build passed with the same application and API routes.
- git diff --check passed. Source audit verifies all non-colour CSS declarations match the rollback source; flower and aurora colour tokens match exactly.

Live browser QA remains unavailable because the managed browser preview was blocked by URL policy. No alternate browser path was used. Desktop/mobile/tablet appearance, real browser console, manual dropdown/modal interaction and measured device performance are unverified. The automated rendering and interaction checks do not replace browser QA. Existing AI/API configuration is preserved; no new live integration claim is made.

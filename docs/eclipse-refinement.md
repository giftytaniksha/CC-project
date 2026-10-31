# Eclipse Black and Ask Bloom

Updated presentation only. Main-app Dark mode uses #020309 background, #0A0C18 standard cards, #1A1C30 elevated surfaces, #25263C borders, #D1C9E5 accents, #F9F7FF text and #AFAFC6 secondary text. No alternative card palettes were introduced. Light-mode base colors and onboarding remain unchanged.

The existing flower is Moonlit Lavender with a fine contrast outline on light surfaces. Geometry, petal count, intro lifecycle, timing and assembly are unchanged. Full-page aurora is removed. Ask Bloom has updated visible labels and refined history, prompts, messages and responsive composer presentation. The reused Canvas/SVG aurora surrounds only the opaque composer, with richer natural colors and 27% faster phase progression. Focus/processing increase luminosity slightly. Reduced-motion and failure fallbacks remain.

The existing sticky header has translucent glass, 16px blur and an opaque fallback. Cards reveal once with 12px movement and 480ms easing. Interactive cards lift 3px on fine-pointer hover. Touch and reduced-motion users skip card motion; keyboard focus cancels active movement. Native scrolling and cursor remain. No provider was activated.

## Files changed

- app/globals.css
- app/nutrition-app.tsx
- components/nutrition/aurora-background.tsx
- components/nutrition/aurora-motion.ts
- components/nutrition/card-motion.tsx
- public/favicon.svg
- tests/studio-ui.test.cjs
- tests/bloom-motion.test.cjs
- tests/eclipse-motion.test.cjs
- docs/eclipse-refinement.md

## Verification

51 tests and TypeScript passed. Tests cover functional regressions, seven screen renders, five onboarding steps, theme persistence, dropdown values, cycle containment, assistant unavailable state, composer-only placement, motion timing/cleanup, keyboard focus, reduced motion and touch fallback. Source comparison confirmed all 20 mutation calls and 79 event handlers unchanged, identical onboarding markup and unchanged protected backend, session, calculation, theme, switch and intro files. No production records were modified. Actual aurora geometry was rendered offline in both palettes at multiple times; these were diagnostic renders, not application screenshots.

Live browser verification remains unavailable following the managed-preview policy block. Windows Chrome, actual desktop/tablet/mobile layouts, live glass scrolling, browser console, real-device performance and end-to-end production interactions remain unverified.

Rollback: dd82fb1cce3b12cc8408f02a68a70ec706899136 (version 8).
Public URL: https://nourish-daily-46.taniksha-neerudu.chatgpt.site

Final production build passed using the supported Sites build helper.

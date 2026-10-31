# Fig & Nectar — colour and surface update

Rollback point: published version 12, source commit `8459d6059284ab29c1c41277d2f0b4c7661d031e`.

## Exact theme and card mapping

| Semantic role | Apricot Atelier / Light | Midnight Fig / Dark |
| --- | --- | --- |
| App background | #EFE2D5 | #171116 |
| Neutral surface / regular cards | #FBF2E9 | #2D2228 |
| Featured / Today's Nourishment | #EBB590 | #693A4B |
| Secondary / Beyond Calories | #D8B8AB | #594332 |
| Highlight / existing cycle estimate | #F0D18D | #684A39 |
| Primary text | #30232A | #FFF0E5 |
| Primary accent | #914859 | #F1B58D |

The existing semantic tokens now map to these values. Supporting labels, tracks, text, borders and icons use the approved supporting colours. Light ordinary supporting text is #53464A; Dark is #DBCBD1. Light controls use approved accent #914859 with #FBF2E9 ink; Dark controls use #F1B58D with #171116 ink. Subtle Light borders are derived from approved neutral/text colours; Dark neutral borders are #48343E. Hover colours use approved #503028 / #F2C88E. Existing shadow dimensions stay unchanged; only their warm colour tint is updated.

The major dashboard cards have two intentional roles, not a random patchwork. Ordinary cards, catalog results, utilities, hydration, editorial panels and planner content are neutral. The existing cycle estimate is the only highlight-role card. Surface colours differ explicitly from their page backgrounds in both themes. An existing later neutral/ambient energy-card rule is overridden locally to ensure the featured colour actually reaches Today's Nourishment. No layout or geometry is changed.

The featured card uses approved label/secondary/heading/track/border tokens. Its Light ring fill uses #503028 against #D39A7F to retain 3:1 contrast; Dark uses #F1B58D against #865768. The supporting card uses #3B2933 / #5E4247 text in Light and #FFF2E5 / #E7CDB5 in Dark. Nutrient fills use approved #914859, #503028, #5E4247, #81532C in Light and #F1B58D, #F8D3D8, #E7CDB5, #F0C48C in Dark, against neutral tracks. Labels identify each nutrient independently of colour.

The previous sage/organic application colours are replaced. The flower's existing brand colours, opening screen and the isolated Ask Bloom aurora remain intentionally unchanged. No illustration is added: the decorative flower is currently absent from Today's Nourishment and is reported separately rather than expanded into artwork work.

## Exact files changed

- `app/globals.css` — Light/Dark/fallback tokens and colour-only card-role rules.
- `tests/studio-ui.test.cjs` — replaces the previous palette expectation with exact Fig & Nectar tokens, role mapping, and contrast assertions.
- `docs/fig-nectar-theme.md` — this report.

## Preservation and performance

No React components, hooks, state, events, calculations, routes, APIs, database, storage, authentication, guest sessions, chart data, profile logic, images, dependencies or rendering engines are modified. No new network request, runtime JavaScript, render loop, animation, asset or dependency is added. Source audit confirms the sequence and values of all non-colour CSS declarations are unchanged, including typography, spacing, layout, responsive rules, animation timing, transforms and hover movement. Flower and aurora colour tokens match the rollback source exactly. Explicit Dark and system-dark fallback token maps match.

## Verification

- Baseline: all 52 regression tests passed; existing production build passed.
- Final: all 52 regression tests passed; TypeScript no-emit passed; existing production build passed.
- Regression coverage includes programmatic renders of Home, Food, Meals, Planner, Progress, Wellness, Ask Bloom, all five Profile steps, guest/account states, theme persistence, onboarding retention, logging, editing/deleting, custom foods, hydration, plans/groceries, chart interaction, cycle settings/toggle, dialogs and dropdown behavior using isolated fixtures. No live user data was used or changed.
- Colour tests cover exact approved surfaces, featured and supporting card mapping, normal text at least 4.5:1 across tested surface pairs, controls and chart marks at least 3:1, the energy ring fill/track at least 3:1, all four nutrient fills against both neutral tracks and secondary-card surfaces at least 3:1, and toggle knob against On/Off tracks at least 3:1.
- `git diff --check` passes. Only the three files above are included.
- Browser limitation: managed browser preview is blocked by URL policy. No alternate browser path was attempted. Live desktop/mobile/tablet appearance, browser console, manual browser interactions, and measured device performance are not verified. Programmatic render/contrast checks are not a substitute for live visual inspection. Source changes introduce no additional runtime work; no measured performance claim is made.
- Existing AI/API integration and configuration are retained; no new AI service is connected or claimed activated.

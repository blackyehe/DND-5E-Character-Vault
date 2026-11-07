# Reader design alternatives and grouped spell lists — 4 November 2026

Four interactive layout alternatives are available in `output/compendium-reader-options-2026-11-04.html`. They are review prototypes, not a selected production redesign. Only the explicitly requested shared spell-list behaviour was published in this release.

## Design alternatives

All four use the same example rules, the existing Barlow/Barlow Condensed typography and theme-aware colour roles. Each removes framed section panels from inside the reading panel and covers benefits, progression data, resource descriptions and the spell-list disclosure:

- **Open folio:** open headings with fine rules, a horizontal two-row progression table, compact benefit columns, and resource formula/recovery/notes alongside the name.
- **Reference ledger:** a section-label rail, paired level/total cells, aligned benefit specifications and compact resource descriptions.
- **Folded sections:** native collapsible section headings with summary information; horizontal progression and benefit rows appear when expanded. The spell list remains its own disclosure.
- **Field guide:** benefits grouped by acquisition level, inline spell/ability facts, a compact stepped progression trace, and resource facts with adjacent descriptions.

The step trace retains recorded breakpoints rather than suggesting fractional spell totals between them. Missing acquisition levels remain “Not specified”; spell level and acquisition level are kept separate. Long content wraps or uses a contained horizontal table scroll on narrow screens. The same sample spell list is grouped and alphabetised in every concept.

The prototypes were checked at 728, 390 and 320 pixels for switching between all four alternatives, independent spell-list expansion, ordered groups, retained missing-level labels, visible resource descriptions and no page-wide horizontal overflow. Their fonts are embedded and they require no server or external requests. The chosen broader design can subsequently be applied through the shared readers to relevant categories; no choice has been assumed.

## Published spell-list behaviour

Production deployment: `dpl_7UvZ3qGgvYFL8iFYKz9Xe2d299B7`, immutable address `https://dndoldal-1wwk80j5l-dndenjoyerstudio.vercel.app`, on both website aliases.

Non-inline spell collections now have their own initially collapsed native disclosure. Expanding it shows cantrips first, numeric spell levels in ascending order, and names alphabetically within each level. Unknown levels remain in a separate final group. Source versions and original references remain independent; the stored source order is not rewritten. Single granted spells in benefit rows remain inline instead of acquiring unnecessary nested dropdowns.

The shared renderer supports both flat reference lists and the known legacy spell-level maps, including numbered slot maps. Verified metadata supplies a spell's level first; explicit source spell levels are a fallback when metadata is unavailable. Conflicting source declarations do not produce a guessed level. Numeric acquisition maps, spells-known schedules, and maps with extra restrictions stay in the lossless reader rather than being reinterpreted as spell levels. Repeated field labels around the new disclosures are removed.

These changes use the existing reference/name-loading and owner/integrity checks. They introduce no new API, persistent cache, schema or game calculation. The broader section frames and vertical totals/resource layout await the user's design selection.

## Checks and isolated release

All 329 tests pass, with the same two optional external-pack tests skipped. Five new tests cover numeric level ordering, alphabetical ordering, source versions, explicit legacy levels, conflicting declarations and lossless fallback. Frontend/backend types and the actual Vite build pass.

The built application passes the existing all-15-category focused-reading checks plus the updated spell-disclosure/grouping assertions. Separate metadata-failure/retry coverage preserves inspectable original references. Desktop/mobile staged and public checks on the real reported class verify default collapse, expand/collapse, level/name ordering, retained source versions, focused reading, keyboard recovery and editing from focus. The class definition fingerprints match before and after; no mutation requests are sent. Standard read-only API and login/navigation/Compendium browser acceptance also pass.

The frozen package derives from verified baseline `dpl_Cxshh3QWN4V7RchbSYJWXH7t9pzR`: five frontend runtime files and one new test, with all 500 hosted source inputs matching their manifest. A preliminary staged build was superseded without public alias assignment while the numeric-map guard was tightened. The final guarded source was rebuilt and rechecked before release. The root checkout's unrelated files were preserved; it was not published wholesale. Server runtime, hosting settings, Frankfurt region and environment-variable names remain unchanged. Owlbear aliases and the user's open room are untouched. No Git commit, push or PR was made.

Rollback: `node .local/reader-design-options-20261104/release.mjs rollback`, while this release owns the public alias. No database work is required.

Ignored evidence: `.local/reader-design-options-20261104/`, including the design plan, source/manifest snapshots, validation/build logs, prototype checks and exact artifact hash, staged/public checks, promotion and final gates. No credentials or private source payloads are included here.

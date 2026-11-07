# Compendium spell-level selector — 4 November 2026

The shared spell-list disclosure now presents one spell-level group at a time. It defaults to cantrips when available, otherwise the lowest populated level. Native buttons show only levels present in that collection, with counts. Unclassified references retain a separate “Level unavailable” group and inspectable original references.

The active button and the Cantrips / Spell level heading use the existing user-theme accent roles. Buttons wrap on narrow screens, expose their pressed state and controlled region, retain native Tab/Enter/Space behaviour, and have visible keyboard focus. A polite live heading announces the selected level.

Names remain alphabetical within a level and source versions remain independent. A selected level survives metadata refresh while it remains available, closing/reopening the disclosure, and focused reading. A replacement collection resets to its default. Metadata arriving after initial rendering selects cantrips automatically when the user has not chosen a level. Inline granted spells, the Field guide layout, resource descriptions and horizontal spells-known tables retain their existing presentation.

No saved source definitions, backend runtime, API, schema, calculation or hosting setting changes. The release derives from verified production baseline `dpl_6epxE73U27UV9GL3TPWd2rfPsCPc`, with two frontend runtime files and one new component test. The frozen manifest contains 502 inputs, excluding unrelated dirty-checkout changes.

## Verification

Live deployment: `dpl_5qRwhMYqmUb5dasrXwbHYoRgauxu`, immutable address `https://dndoldal-1lc1gae67-dndenjoyerstudio.vercel.app`, verified on both website aliases. Staged/public acceptance and the exact 502-file hosted source audit pass. Rollback target: `dpl_6epxE73U27UV9GL3TPWd2rfPsCPc`.

All 337 tests pass, with the same two optional external-pack tests skipped. New component coverage checks asynchronous metadata, default and explicit selections, missing cantrips, disappearing groups, unresolved references and replacement collections. Frontend/backend types and the production build pass.

Read-only built-app acceptance covers all 15 focused categories plus 390/320px layouts, light/dark/custom-accent preferences, one visible spell-level group, only populated level buttons, native Enter/Space selection, sorting, dropdown state, focus state and name-loading retry. Staged/public checks use the real reported class, exercise every available spell level, verify colour against the actual theme accent, and compare saved definition fingerprints before and after. Mutations are blocked in these checks.

The source manifest, alias ownership, unchanged environment names/Frankfurt execution, preserved unrelated root files and Owlbear aliases are checked before and after promotion. No Git commit, push or PR is made. Local evidence and release state are under `.local/reader-spell-levels-20261104/`; rollback is `node .local/reader-spell-levels-20261104/release.mjs rollback` while this release owns the website aliases.

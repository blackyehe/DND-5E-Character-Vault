# Selected Compendium Field guide layout — 4 November 2026

The user selected Field guide from the four reader alternatives, with the standard horizontal table for spells known. This change applies the selection through the shared Compendium reader, covering relevant classes, subclasses, races, subraces and other reference categories in normal and focused reading.

## Presentation

Section headings use the existing theme accent and typography, with open content instead of framed panels inside the main reader. Scalar facts run horizontally and wrap; nested or unfamiliar structures retain the recursive reader.

Benefits group by explicit acquisition level, with names and source attribution beside compact spell-level/ability facts. Grants within a level keep source order. Unspecified levels remain labelled “Not specified”; the spell's own level is never substituted for its acquisition level. The spell level appears once in each grant's metadata.

Spells/cantrips known use horizontal Level / Total known tables. Imported gained-at-level schedules retain the distinct “Gained” heading. Only the recorded breakpoints appear, including zero values; complex schedules retain their lossless table presentation. A keyboard-focusable horizontal scroll region contains wide tables on narrow screens.

Complete Workshop resources show names beside a descriptive maximum formula, availability, recovery and notes. The formula expresses the saved basis, multiplier, base and minimum; it does not evaluate against an invented character or change game calculations. Inactive editor ability settings are omitted from formulas that use a different basis. Additional source fields, non-text notes and unusual resource shapes remain readable.

The existing initially collapsed spell-list disclosure, spell-level/name ordering, source-version distinctions, name lookup and retry behaviour remain available. No saved definitions, API contracts, database schema, backend runtime or hosting configuration change.

## Validation and release

Live deployment: `dpl_6epxE73U27UV9GL3TPWd2rfPsCPc`, immutable address `https://dndoldal-ey9byos6t-dndenjoyerstudio.vercel.app`, verified on both website aliases. Staged and public acceptance pass; release verification is recorded in `.local/reader-field-guide-20261104/final-gates.json`. The package derives from verified production baseline `dpl_7UvZ3qGgvYFL8iFYKz9Xe2d299B7`, with five frontend runtime files and one new test file. It contains 501 exact manifest inputs and excludes the dirty checkout's unrelated changes.

The full suite passes 334 tests, with the same two optional external-pack tests skipped. New assertions cover grouping and acquisition/spell level separation, preserved breakpoints, resource formulas, zero values and unknown-source fallbacks. Frontend/backend types and the Vite production build pass.

Read-only built-app checks exercise all 15 focus categories, desktop and narrow mobile layouts (390 and 320 pixels), keyboard scrolling of full-width schedules, canonical sections, grouped benefits, resource notes, spell-list expansion/order, metadata retry, same-node focus without another detail fetch, scroll/focus recovery and opening the existing editor. Screenshot review covers desktop and mobile. Separate staged/public checks use the real reported class, with source-definition fingerprints checked before and after and mutation requests blocked.

All unrelated root files and Owlbear aliases are verified unchanged. No Git commit, push or PR is made. Rollback uses `node .local/reader-field-guide-20261104/release.mjs rollback` while this release owns the website aliases; no database change is required.

Ignored local evidence: `.local/reader-field-guide-20261104/`, including baseline snapshots, design plan, frozen source/manifest, checks, screenshots, source audit, promotion and final gates. Credentials and private entry payloads are not included in this report.

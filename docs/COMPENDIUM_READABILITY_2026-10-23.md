# Compendium imported-rule presentation

The shared ReferenceValue reader rendered each modifier as a nested Type / Level / Value definition list. Blood Magic reproduces the supplied screenshot. The same pattern appears in imported classes, subclasses, races and character options.

The fix changes presentation only. No imports, saved packs, builder rules, APIs or campaign data change.

## Layout decisions

Keep the established Night and Parchment themes and Barlow body / Barlow Condensed heading typography. The reviewed Night tokens are paper `#1a161a`, ink `#f1edef`, muted `#c1b9be`, rule `#623a45`, soft background `#36242a`; the production CSS continues to use the existing variables. Left-aligned level/benefit tables replace repeated structural labels. Dividers separate actual source rows. Casting details remain attached to each spell; source order stays intact. No additional motion or decorative cards are introduced.

Nested primitive fields place label and value side by side; complex rules retain full width. Named object lists use their names as headings. Known spell/cantrip schedules use tables distinguishing gains from totals; spell lists distinguish spell levels from acquisition levels. Patron/domain spell slot indices become readable spell lists. Unknown structures retain the generic reader.

## Fidelity

- Missing acquisition levels display “Not specified”; they are never assumed to be level 1.
- A spell's own level and casting ability remain separate from its acquisition level.
- Unknown modifiers and additional fields remain visible. Zero and false remain valid values.
- Recognizers require the appropriate field context; unrelated numeric maps do not become level tables.
- Source values are not mutated. Existing metadata filtering remains in place.

## Validation

- Saved 126-pack corpus audited read-only: 411 modifier/selection arrays, 257 nonempty arrays, 1,009 rows; all nonempty arrays recognized with unchanged row counts. These are raw definition counts, including source variants, not a unique-entry count.
- `npm.cmd test -- src/lib/compendium-structured.test.ts`: six tests passed, covering real Blood Magic/Revenant Shadow shapes, unknown fields, restrictions, level ambiguity, numeric-map fallback, zero/false, and nonmutation.
- `npm.cmd run build`: frontend typecheck and Vite production build passed.
- Actual Vue reader reviewed in hidden headless Edge at 1440, 720, 390 and 320 CSS pixels, using Night/Parchment and real source fixtures. Blood Magic, Revenant Shadow spellcasting and unusual nested rules: no horizontal overflow or runtime errors. UI remains readable with long spell names and multiline restrictions.
- Root publishing remains paused. Prepare the narrow delta against combined branch checkpoint `0b754e5`; no Maps files are included.

Screenshots, the complete raw fixture, audit scripts and transfer artifacts are disposable local review files under `.preview.local/compendium-reader/`, excluded from the app patch.

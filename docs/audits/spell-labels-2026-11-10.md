# Spell detail labels - 10 November 2026

One shared component presents bold Casting time, Range, Duration and Components
labels in the website spellbook (ordinary/innate), party combat view, Compendium,
character creation and level-up previews. It retains ritual/concentration markers
and reports missing values as "Not recorded". Spell definitions and calculations
are unchanged. Per-spell attack/DC rows and Owlbear remain separate work.

The candidate overlays six frontend files onto the exact preceding production
release, `dpl_BBrEU5XjSSpSNeBkfKu91mziGXWx`. Changed-file preimages were verified;
PartyCombatKit and CompendiumView differed only in mixed line endings. Focused
spell-grouping checks, both type checks and the production build passed.

Reproduce with `scripts/releases/spell-labels-2026-11-10.json` and
`scripts/releases/validate-character-option-review.mjs`. Small manifests, preimages
and release receipts are retained in `.local/spell-labels-20261110/` for rollback
and reconstruction; review them on 10 December 2026. Managed source copies and
dependency links are removed after validation.

Deployment verification is recorded after promotion.

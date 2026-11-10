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

Live on both website aliases as `dpl_2obs3AK3DTVgkTbtn5Dv4sGnaSur`:
https://dndoldal-o0pfp6mjp-dndenjoyerstudio.vercel.app.
Patch checkpoint: `2bbcf86`. All 542 hosted source hashes match the candidate;
region and custom environment-variable names match the preceding release.
Five focused checks, both type checks and the production build passed. Public
health is JSON 200 and anonymous character access is JSON 401. Independent
Owlbear aliases remain on `dpl_6yPZh1hytcg8a2XNzSHnRpZjpz8W`.
Workspace check reports zero scratch runs and zero Vitest filesystem cache.
Rollback while this release is current:
`node .local/spell-labels-20261110/release.mjs rollback`.

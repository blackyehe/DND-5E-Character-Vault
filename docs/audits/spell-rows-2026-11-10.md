# Compact spell rows - 10 November 2026

The user selected B from the three spell-presentation proposals. The website's
Spells panel now uses compact shaded rows with source/ability below the spell
name and applicable attack expression or save DC on the right. Spell definitions
expand inside the same row. Prepare controls remain separate. Surfaces derive
from the current sheet theme; bold casting labels, school/level, full rules,
source provenance, and higher-level text remain readable. Narrow layouts wrap
preparation controls below the spell; the existing independent columns remain.

One shared entry serves ordinary and granted spells. The former use the sheet's
recorded casting ability and the honest source label Spellbook; published class
lists do not determine a character's casting source. Racial and structured feat/
feature grants use their own recorded ability and source. The former Innate racial
spells group is renamed Granted spells because it also contains feat grants.

Attack/save calculations use the same current characterBenefits snapshot as sheet
totals, including active item, attunement and approved source bonuses. Calculated
rows react to nested character and definition changes. Structured attack_type
and dc.dc_type fields determine applicable values. Utility spells show no attack
or save; missing definitions, unconfirmed grants and unstructured imported rules
receive explanatory text rather than invented results. Unknown imported mechanics
can be recorded through the existing spell editor. Readouts do not roll dice,
spend slots, or alter preparation. Spells with both attack and save fields show both.

The release reconstructs `dpl_Eb3yGcTZHVcyR9HTABHwFhpcjXkz` and overlays only
four frontend runtime files and two regression-test files. Source manifests and
small exact preimages are retained in `.local/spell-rows-20261110/` to reconstruct
the tested candidate and rollback; review them on 10 December 2026. Validation
uses `scripts/releases/spell-rows-2026-11-10.json`, managed temporary source copies,
existing dependencies, two Vitest workers and no filesystem module cache.

Seven focused tests cover agreement with sheet totals, different grant abilities,
item/attunement/feat changes, applicable attack/save combinations, missing rules,
rendered source labels, granted scaling text, preparation and search controls.
This is a frontend presentation release; campaign records and backend schemas
are not migrated. Owlbear remains a separate rollout.

# Imported item validation — 29 October 2026

Release follow-up: **published and publicly verified** after merging onto the live Workshop UI source. See [the item release, hosted checks and rollback evidence](imported-item-release-2026-10-29.md). The original local evidence and old candidate below are historical; the deployed package has 406 runtime files.

## Problem and correction

The earlier [availability audit](character-compendium-player-audit-2026-10-29.md) found 47 rejected definitions among 6,603 imported equipment/magic items. Live synthetic grants reproduced HTTP 400 for fixed-damage blowguns and special nets. These were item conversion/validation limits; this fix does not change cache storage or synchronization.

- The 43 blowgun variants retain their fixed base damage `1`. Browser and server validation share a pattern supporting ordinary dice, optional modifiers and fixed nonnegative integers up to 9,999.
- Three weapon definitions with both base damage and damage type absent retain those blank values and explicitly use manual special rules. No dice, damage type or automatic damage bonus is invented. The sheet displays “Special rules · see description”. Incomplete ordinary weapons still fail validation; users can deliberately choose special-rule handling in the composer. Existing net definitions with explicit no-direct-damage stats keep their previous display.
- The 31,137-character description is preserved in full. Description/reference-description limits are now 100,000 characters, shared by the server and composer. Larger submissions still fail; nothing is silently truncated.

No pack rewrite, database migration, private-library upload, account change or billing change is involved. Ordinary inventory delivery, permissions, duplicate-delivery prevention and attunement limits remain in place. Special conditional effects continue to require manual adjudication.

## Verification

- Replayed the previously captured, consistency-checked **126-pack snapshot** using both workspace code and the isolated candidate: all **6,603 definitions** validate and pass delivery preparation; **zero failures**. This checks the saved snapshot, not a fresh authenticated inventory of the current private library.
- Hashed every nonempty imported description and every existing reference description before and after delivery preparation: all are retained exactly. Existing enrichment adds base references to 2,804 items and fills 11 empty descriptions; these additions are not lost source text.
- Six new focused assertions cover fixed damage, two absent-base-damage source forms, ordinary malformed damage rejection, HTML/server pattern agreement, and oversized text retention/bounds. The focused three-file suite passes **22 tests**. The full workspace suite passes **656 tests, 55 existing skips**, with no failures. An initial concurrent run hit one existing 5-second large-import test timeout; the complete rerun with two workers passed without changing the test or its timeout.
- Workspace and exact isolated candidate frontend builds and server type checks pass. The isolated build spent about 107 seconds in stylesheet generation; this is build time, not website loading time.
- **Nine API/desktop scenarios** pass against both workspace and the isolated candidate. They cover four actual item deliveries and repeated request IDs, invalid/foreign delivery rejection, HP/resource preservation, imported picker → editor draft → permanent save, fixed/special damage in player Combat, full long rules in player Equipment, and reference access revocation. The empty-library player receives copied rules without importing the owner's pack. No browser JavaScript exceptions, invalid-pattern warnings or unexpected API errors occurred. Fixture assumptions about resource fields and nested disclosures were corrected before the final successful runs.
- All fixture databases were loopback-only, randomly named and dropped after host/database assertions. No production content was changed. The candidate's four delivery/retry pairs took 17-30 ms locally; these tiny loopback fixtures are not hosted/private-library performance measurements.

## Isolated release candidate

The candidate starts from all 404 runtime files of the verified live creator release and changes only:

1. `server/lib/inventory.ts`
2. `shared/imported-items.ts`
3. `shared/item-validation.ts` (new)
4. `src/components/items/ItemComposer.vue`
5. `src/lib/equipment.ts`

Its 405 runtime files match their manifest exactly. Unrelated extension, selective-cache, editor and Git/live differences are excluded. The candidate source is frozen under `.local/item-validation-20261029/release-source/`; it has not been uploaded. Hosted owner/player checks and a fresh deployed-source audit remain prerequisites for promotion. The production creator release is the rollback baseline for that future release.

Ignored evidence: `.local/item-validation-20261029/`, including the 47-failure baseline, both full-library replays, focused/full tests, build/type logs, five-file scope/manifest, source audit, workspace workflow and exact-candidate workflow results/screenshots. Earlier failed fixture diagnostics are superseded by the final passing results. Private source descriptions and credentials are excluded from this report.

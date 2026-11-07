# Imported item release — 29 October 2026

Published at https://dndoldal.vercel.app as **`dpl_7Jbd9NP4ggJEct2icbiRGde5YG7R`**. Reviewed deployment: https://dndoldal-f7ut2la39-dndenjoyerstudio.vercel.app. Public alias, bundle and authenticated item controls are verified. Rollback target: `dpl_D9rV4wEVv9gkYLsq5CFyHSs9dG8N`.

## Scope

The [locally verified item fixes](imported-item-validation-2026-10-29.md) are merged onto the live Workshop UI deployment, `dpl_D9rV4wEVv9gkYLsq5CFyHSs9dG8N`. Exactly five runtime files change: the inventory validator, imported-item converter, shared validation constants, ItemComposer and equipment attack presentation. The source package contains 406 runtime files; all other live files, including the new Workshop UI, are preserved.

Fixed base damage such as `1` is accepted without converting it into invented dice. Imported weapons with no ordinary damage dice or type explicitly use manual special rules. Complete descriptions up to 100,000 characters survive validation and delivery; larger inputs are rejected. Malformed ordinary damage remains rejected. Special conditional effects continue to require manual adjudication.

This affects new item selections/deliveries and validation when saving items. Existing inventory copies are not rewritten, and imported pack sources are not migrated. Authorization, delivery deduplication, attunement limits, room assignment checks, cache transport and billing are unchanged. Retained selective-cache and unrelated editor/extension work are excluded. No Git commit/push is included; deployment uses the exact isolated source package.

## Local validation

- The exact source builds and passes server type checking. Three focused suites pass 22 tests.
- Replayed all 6,603 equipment/magic-item entries from the previously captured, consistent 126-pack snapshot: zero failures. All existing nonempty descriptions and reference descriptions retain their hashes through delivery preparation. This is saved-snapshot evidence, not a fresh authenticated audit of the current private library.
- Nine exact-source API/desktop scenarios pass: four deliveries with retry deduplication; validation/ownership boundaries and HP/resource preservation; editor permanent saves; empty-library player views with full long rules; and access revocation. No browser exceptions, validation-pattern warnings or unexpected API errors occurred. The loopback fixture database was dropped after explicit host/database assertions.

## Hosted and public checks

Ten hosted scenarios pass: isolated owner/player boundaries; four item grants with request-ID deduplication; validation limits and HP/resource preservation; imported picker through permanent editor save; empty-library player damage/rule presentation; player HP updates with stale-write rejection; and API/open-sheet revocation. Full 31,137-character copied rules retain their hashes. Invalid ordinary damage and 100,001-character input return HTTP 400; foreign delivery and private definition reads return 404. There are no browser exceptions or unexpected API errors.

The synthetic character, pack, assignment and added room membership were removed. Owner active characters, packs and item library and the player's imported library are verified empty. Existing archived synthetic records from earlier audits were preserved. No real library was edited. Individual hosted synthetic grant responses took 511-1,751 ms; these are small-fixture observations, not private-library loading benchmarks.

All 406 deployed files match the source manifest. The public main script matches the reviewed deployment. Security headers and six unauthenticated 401 boundaries pass. An authenticated public check confirms the six Workshop categories, fixed-damage HTML validity, manual-special controls, the 100,000-character text limit, and no JavaScript/pattern warnings. Its temporary form was cancelled without saving content. An initial exact label locator did not match the select's text; the corrected partial label completed the check. Initial alias verification observed normal promotion propagation; the final alias receipt confirms the new deployment.

## Release evidence

Ignored evidence is under `.local/imported-item-release-20261029/`: source/allowlist/manifests, focused tests, full-library replay, build/type logs, local owner/player results, hosted checks/cleanup, exact deployed-source audit and publication/public receipts. Earlier local evidence remains frozen in `.local/item-validation-20261029/`.

The preceding Workshop UI deployment is retained as the rollback target. The existing Workshop layout and all unrelated source files are preserved.

# Workshop UI release — 29 October 2026

Published at https://dndoldal.vercel.app as **`dpl_D9rV4wEVv9gkYLsq5CFyHSs9dG8N`**. Reviewed deployment: https://dndoldal-a4tg4wt5y-dndenjoyerstudio.vercel.app. The public alias, public bundle and authenticated Workshop controls are verified. Rollback target: `dpl_2RYNZuT8g8d4UvY7At6cWvwzcCDB`.

## Approved scope

The [previewed Workshop layout](workshop-ui-consistency-2026-10-29.md) gives all six categories common search/action placement, headings, widths and cards. Draft-saving shortcuts are grouped below the Workshop category tabs. The item/action account-library flows and specialised editors remain intact. The shared header backup flushes active drafts; pre-release review also moved its failure/success feedback out of the rules-only branch so it is visible in every category.

## Isolation

The source package starts from all 404 runtime files of the verified creator release, `dpl_2RYNZuT8g8d4UvY7At6cWvwzcCDB`, and has an explicit eight-file frontend allowlist. The new shared component brings the total to 405 runtime files. The Compendium change carries across only the Workshop toolbar import and header/template layout; the live reader, authorization, cache invalidation and detail-rendering body are preserved.

The imported-item validation candidate, retained selective caching, unrelated extension/editor work and Git/live differences are excluded. No server file, database schema, account migration or billing setting changes. No Git commit/push is included; this release uses a separately audited source package. Existing source guards are retained.

## Validation

The exact isolated source builds and passes server type checking. Twelve local desktop/API scenarios pass with cleanup, including a simulated backup failure and successful retry from the item category. No browser exceptions, console warnings or unexpected API failures occurred. The initial browser launch exited before a page opened; a bounded retry completed the full suite.

Nine hosted scenarios pass: account isolation; all six category layouts; actual class/rule publishing; option saving and all eight type actions; item saving/filtering/editing; monster backup, draft retention, publishing and action navigation; item recovery; embedded/standalone Compendium readers; and 1024px layout with no browser exceptions or failed API calls. The initial class fixture lacked offered skills, so the existing save guard correctly blocked it; adding valid fixture choices resolved the check without an application change.

Synthetic packs were deleted and the account has no active characters, packs or items. The synthetic item remains archived in that test account's Recently deleted through the supported recovery API; prior archived content was preserved. No real account library was edited.

All 405 deployed runtime files match the manifest. Public security headers and six unauthenticated 401 boundaries pass, and the main script matches the reviewed deployment. The authenticated public check confirms all six shared category tools, all eight option controls, no page overflow and no JavaScript exceptions.

## Evidence

Ignored release evidence is under `.local/workshop-ui-release-20261029/`: baseline/allowlist, source manifest, build/type logs, exact-source local desktop checks, hosted saves/cleanup checks, deployed-source audit, promotion and public verification receipts. The initial unaliased stage is superseded by the backup-feedback correction and will not be promoted. The earlier [33-test authoring check](workshop-ui-consistency-2026-10-29.md) and visual screenshots remain supporting evidence.

The previous creator deployment is retained for rollback. Production publication required an exact deployed-source match, passing hosted HTTP and authoring checks, and synthetic fixture cleanup; all passed before promotion. The separate imported-item candidate must be rebased onto this release before any later publication, to preserve the UI.

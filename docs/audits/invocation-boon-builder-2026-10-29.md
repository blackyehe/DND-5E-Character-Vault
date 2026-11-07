# Invocation and boon authoring — local implementation, 29 October 2026

The second option-builder stage extends the existing feat/background implementation to invocations and boons. Authoring, draft recovery, pack persistence, creator/editor selection, reviewed grants and selected-only room references are connected locally. No commit, push, deployment or production-data write was performed.

## Behavior and safeguards

- The Workshop section is now **Character options**, with feats, backgrounds, invocations and boons. All four reuse the existing guided forms, native identity/revision handling, pack conflict checks, supported Benefits, backups and trash recovery. Unsupported imported rules are not converted into invented automation.
- Creation and the editor's Features section offer **Browse invocations and boons**. Their catalog loads only after that action, from an authenticated endpoint returning those two categories. Ordinary creator/editor opening and creator draft reload do not request this optional catalog. This is an optional character-choice picker, separate from automatic Compendium background preparation.
- A selection displays its description, available prerequisite text and supported Benefits. Adding it requires an explicit acknowledgement that the class/table grants it and an acquired level from 1 through 20. These choices do not consume feat opportunities. Class allowance counts, arbitrary prerequisite prose and nested choices still require table review.
- Versioned feature references retain category and definition ID. Equal names in different categories remain separate; aliases prevent re-adding the same native definition. Future-level selections remain saved and visible, but supported grants activate only at their acquired level. Unreadable or unconfirmed saved creator selections remain recoverable and block creation until repaired or removed.
- Newly selected native grants are pinned. Pack edits/renames and ordinary character saves retain reviewed values; explicit review replaces the previous snapshot once. Existing legacy reviewed invocation/boon rules without definition references remain available on ordinary edits. No data migration or pack reimport is required.
- Assigned players receive selected invocation/boon definitions and copied feature text without importing the owner's packs. Unrelated library entries and owner edit routes remain unavailable. Deletion reports an unavailable source while retaining approved rules; supported trash recovery restores native identity. Deselecting removes grants, and unassignment revokes room reads.
- Owner reference projection advances to `selected-options-4`, with validation of optional invocation/boon arrays before persisted data is reused. Existing authenticated mutation invalidation remains in place; room responses remain outside persistent owner caches.

## Verification

- Frontend type checking/production build and server TypeScript checking pass. Final workspace suite: **634 passed, 55 skipped, zero failures**.
- **16 isolated API scenarios pass**, including the prior feat/background regressions, authenticated/scoped catalogs, manual confirmation, acquired-level activation, category identity, selected-only player references, pinned/explicitly reviewed grants, missing sources, trash restoration, deselection and assignment revocation.
- **10 desktop Edge scenarios pass** against the real compiled frontend and local Express/MongoDB routes: draft reload, author/save/reopen, invocation/boon authoring, lazy catalog requests, required acknowledgement, future-level draft recovery, completed creation, editor addition/duplicate prevention, assigned-player visibility and no JavaScript exceptions or failed API responses.
- Desktop screenshots were inspected for Workshop form layout and player feature visibility. Invocations/boons currently appear in the sheet's existing Other / unclassified feature group; their acquired levels are visible. No dedicated invocation/boon sheet grouping is claimed.
- The fixture supplies fictional standard Human/Fighter responses and synthetic accounts/content. Actual option, character, review, pack and room routes use isolated local MongoDB databases. Both fixtures report successful cleanup, including browser/server closure and database removal. No public website calls or current private-library audit are claimed.

Evidence, fixtures, before-source copies, logs, screenshots and JSON results are ignored under `.local/manual-options-20261029/`. Earlier intermediate failure files remain diagnostic history; `ui-results.json` and `final-tests.json` contain the passing final run.

## Payload measurements and limits

The integrity-verified 23 October snapshot contains 126 packs, including 73 invocations and 4 boons. Expanding the server character-rule catalog from six to eight categories increases serialized content from 4,318,814 to 4,437,892 bytes: **119,078 bytes, approximately 2.76%**. This adds server catalog work even though the new picker request is deferred.

The two-category picker response is 119,079 serialized bytes / **12,774 gzip bytes** on that snapshot. The final direct lazy picker assets are 5,088 JavaScript bytes / 2,335 gzip bytes, plus 2,407 CSS bytes / 694 gzip bytes. These asset figures exclude shared dependencies and are not a comparison with the exact live release. Catalog serialization is not a measurement of MongoDB wire transfer or hosted latency; no loading-time reduction is claimed. Existing scoped-reader fallback behavior remains possible.

## Remaining work and release limits

Durable choice groups remain next: stable child identities, explicit allowed counts, saved selected IDs, nested/duplicate selection validation and changed/removed option handling must be designed before exposing that UI. Languages/reference creation and parent-aware subrace authoring remain separate work.

The biography/notes save omission, special imported-item validation failures and long creator name-field anomaly remain queued in the earlier audit. The desktop fixture enters the name early and does not claim to resolve that failure sequence. This stage does not complete the whole option-builder plan.

Publishing still requires a reconciled candidate against the exact live source, dependency/transfer checks for that candidate and hosted verification. The existing Git/live discrepancy and unrelated dirty extension/editor/cache work are preserved. The passing local stage is not approval to deploy the dirty checkout.

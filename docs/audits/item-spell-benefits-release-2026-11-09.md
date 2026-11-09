# Item spell bonuses released — 9 November 2026

The item-benefit preservation fix is live at https://dndoldal.vercel.app.

- Deployment: `dpl_5hNyMEtRgxcYMbz3M9yoUpvj1S3U`.
- Previous production/rollback: `dpl_5qRwhMYqmUb5dasrXwbHYoRgauxu`.
- Immutable URL: https://dndoldal-i99m3601r-dndenjoyerstudio.vercel.app.
- Patch checkpoint: `dd9d41c` on `codex/recovery-checkpoint-20261107`.

Configured Benefits now survive imported-item conversion and native template
selection/delivery, inventory validation and database serialization. Captured
item grants feed the existing equipped/quantity/attunement and unlock-level
calculations. Reviewed definitions replace captured grants, including explicit
removal, without applying both copies. Item rules display captured Benefits.
Existing copies are updated through explicit review rather than rewritten by
deployment.

The release preserves the current 502-file hosted source and overlays ten
runtime files plus regression tests. All 508 candidate inputs were checked by
SHA-1 against the hosted deployment. The isolated exact-production candidate
passes 400 tests (two optional tests skipped), frontend/backend types and the
production build. The broader working checkout's full suite also passed 1,083
tests before release isolation. Dependencies were reused; temporary source,
build output and dependency junctions were removed through the managed workspace.

Both website aliases point to the new release. The custom environment variable
names and Frankfurt region match the preceding deployment. Public health returns
200; unauthenticated character and item requests return 401. Both independent
Owlbear extension aliases retain their previous deployment.

The authenticated live check confirmed Zhaerin Prison had configured +3 spell
attack/save-DC benefits, but Volenta's already-given item lacked them. The normal
Compendium review proposed only benefit and equipment changes. Applying that
saved edition to Volenta produced a visibly rendered Combat indicator of **+11
spell attack / save DC 19**, with no displayed errors. A hash comparison excluding
the intended benefit snapshot, reviewed definitions and modification timestamp
confirmed all other saved character state was preserved. No item was replaced,
duplicated, unequipped or removed during verification.

Concise manifests and release receipts are retained under the ignored
`.local/item-spell-benefits-release-20261109/` directory. Immediate application
rollback is `node .local/item-spell-benefits-release-20261109/release.mjs rollback`
from the project root, provided the public alias still points to this release.
Application rollback does not undo the explicitly approved character rule review.

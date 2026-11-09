# Resource panels and inventory removal — 9 November 2026

Checkpoint: `576eab7` on `codex/recovery-checkpoint-20261107`.

Released to both website aliases as `dpl_3pKTvMLAEZ5Ps555nQmB8tx6QvJM`:
https://dndoldal-e2vx2dunc-dndenjoyerstudio.vercel.app.
Previous/rollback deployment: `dpl_CBitkm3auCwY8ZziXSoiYG2X65WF`.

Two lighter tasks from the character-workflow backlog:

- Combat resource cards share aligned title, counter, pip, control, note and
  recovery rows. Compact density stretches cards consistently; modern browsers
  use subgrid for shared row alignment. The narrow folio rail keeps its list
  layout. Spell attack, save DC and casting ability have a separate, larger strip.
- Equipment has an owner/DM Remove item control with inline confirmation for
  the whole stack. Removal operates on the saved row, not its filtered/sorted
  position or hydrated library copy. Character ID, saved version and exact row
  contents must still match. The existing update endpoint performs the write
  with expectedUpdatedAt. Failed saves keep the inventory and confirmation;
  existing player write permissions are unchanged.

The broader Workshop/Compendium edition reconciliation is explicitly deferred
at the user's request. Its resume point and the rest of the requested work remain
in `docs/CHARACTER_WORKFLOW_BACKLOG_2026-11-09.md`.

Validation: 51 focused tests pass, including spell bonus activation/removal,
filtered/sorted inventory removal, changed versions/rows/characters, failed-save
retry and permission/saving guards. Frontend/server type checks and the production
build pass against the exact deployed baseline with only three runtime files
overlaid. No campaign records were changed during validation.

Reproduce isolation with:
`node scripts/releases/validate-character-option-review.mjs scripts/releases/sheet-usability-2026-11-09.json`.
Concise source manifests and release receipts are retained in the ignored
`.local/sheet-usability-20261109/` directory; disposable source/build files and
dependency junctions are removed by the managed workspace helper.

All 519 hosted input hashes match the validated candidate. Frankfurt region and
custom environment variable names match the preceding release. Public health
returns JSON 200; anonymous character and Workshop requests return JSON 401.
Both independent Owlbear extension aliases remain on their previous deployment.
Workspace hygiene reports zero scratch runs/cache. Rollback, while the website
still points to this release:
`node .local/sheet-usability-20261109/release.mjs rollback`.

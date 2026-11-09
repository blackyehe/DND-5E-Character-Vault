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

## Summary follow-up

Live on both website aliases as `dpl_827hsYMEGD9Jx4HaS1BZsXaXZTiN`, immutable
https://dndoldal-agvx68n7d-dndenjoyerstudio.vercel.app.
Previous/rollback: `dpl_3pKTvMLAEZ5Ps555nQmB8tx6QvJM`.

Checkpoint `be99e08` adds website Summary controls using existing calculations:
six effective saving throws below skills, equipped/custom attacks and spell
attack/DC above Training, and a top-of-summary Long rest action. The same pure
`restUpdate` helper now powers Combat's rest controls and Summary. Short/long
recovery respects tracker recovery modes; manual and unlimited trackers are
preserved. HP and hit dice remain manual and the UI states this explicitly.

Player updates use the existing play-state boundary; no permissions or permanent
editing fields were added. Double submission is blocked and failed saves keep
the saved state. Fifty focused checks, both type checks and the production build
pass against the isolated exact production baseline. The candidate contains 522
inputs, overlaying three runtime files onto the preceding 519-file deployment.

Configuration: `scripts/releases/summary-controls-2026-11-09.json`. Concise
manifests/receipts: `.local/summary-controls-20261109/`. No campaign data was edited
while verifying. Owlbear's separate summary/frontend and scoped rest write action
remain pending; the broader authoring reconciliation resume point is unchanged.

All 522 hosted input hashes match the candidate; region and custom environment
variable names match the preceding deployment. Public health is JSON 200;
anonymous character/Workshop requests are JSON 401. Both Owlbear extension aliases
retain their prior deployment. Application rollback, while this release is current:
`node .local/summary-controls-20261109/release.mjs rollback`.

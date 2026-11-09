# Workshop character-option review — 9 November 2026

Checkpoint: `40ce3e9`, branch `codex/recovery-checkpoint-20261107`.

Released to both website aliases as `dpl_CBitkm3auCwY8ZziXSoiYG2X65WF`:
https://dndoldal-mqud7ovcf-dndenjoyerstudio.vercel.app.
Previous production/rollback: `dpl_5hNyMEtRgxcYMbz3M9yoUpvj1S3U`.
Both independent Owlbear extension aliases retain
`dpl_6yPZh1hytcg8a2XNzSHnRpZjpz8W`.

This increment adds the existing explicit character-review workflow to Workshop
character options. Compendium and Workshop use the same component and endpoints.
Reviews show actual spell attack/DC totals, followed by complete rule changes.
Saving or editing the draft invalidates the old comparison. Source, character and
review-hash conflicts require a new review; approval never happens automatically.

Option saving now explains missing fields, invalid Benefits, invalid filenames
and unavailable destination packs. A successful save immediately updates local
option/pack identities and releases the form, including when the pack is new.
It does not wait for another complete library load. Prepared reads request all
complete option categories, verify the owner/source metadata again, and fall back
to the full library if verification fails. Publishing then reads only the target
pack source. Existing revision/hash and database compare-and-swap guards remain.

Read-only inspection of the live campaign found the saved Workshop Zhaerin
Contractor revision 1 and Volenta's approved copy both had empty Benefits arrays.
The requested +1 spell attack/+1 spell DC had not reached the saved source. No
campaign records were edited during this increment. The HTTP regression reproduces
that feat update across changing source fingerprints, retaining the equipped +3
focus: spell attack +11 to +12 and save DC 19 to 20, then back on benefit removal.
HP, used slots, resources and inventory state remain unchanged.

Validation:

- Working checkout: 1,141 tests passed; 67 optional/environment tests skipped.
- Exact production candidate: 499 tests passed; two optional tests skipped.
- Frontend and server type checks and production build passed.
- A matrix covers all 30 offered Benefits, their removal and repeat calculation.
- Component/HTTP tests cover stale reviews/saves, confirmation, account changes,
  late responses, pack hashes, target-only reads and preservation of device drafts.
- Managed source/build files and dependency junctions were removed; workspace
  hygiene reports zero scratch runs and no Vitest filesystem cache.

The candidate preserves all 508 preceding hosted inputs, replacing only eight
runtime files plus regression tests (518 inputs total). Concise manifests,
validation results and deployment receipts are under the ignored
`.local/character-option-review-20261109/` directory. The validation harness is
`scripts/releases/validate-character-option-review.mjs`.

All 518 hosted input hashes match the candidate. Custom environment variable
names and Frankfurt region match the preceding production deployment. After
promotion, health returns JSON 200; anonymous character/item/Workshop/review
requests return JSON 401. No authenticated save/apply was performed against
campaign records. Rollback is
`node .local/character-option-review-20261109/release.mjs rollback`, while the
website aliases still point to this release.

Open work is listed in `docs/CHARACTER_WORKFLOW_BACKLOG_2026-11-09.md`. In particular,
this increment does not reconcile personal Compendium editions with native pack
edits across every creator, or add character-side pending-update indicators.

# Compendium builders preview — 2026-10-23

Status: user approved the preview and requested production on 2026-10-23. The exact reviewed deployment was promoted; see [release record](COMPENDIUM_BUILDERS_RELEASE_2026-10-23.md).

Staged and verified: `dpl_EmvAJ4VcZUCYob7vbfqFRG3yJfjM`, `https://dndoldal-2e9tb1iw7-dndenjoyerstudio.vercel.app/builder-preview`. Seven-day share access is stored separately in local preview evidence. Hosted all-category gallery checks pass; health returns 200 and protected editing/review endpoints return 401 without authentication.

## Behavior

All 15 Compendium categories open a builder with the entry's existing information already filled in. Class/subclass/race/subrace reuse the Workshop editors and previews. Monsters share the Monster Workshop core fields, detailed statistics, action editor and live statblock. Equipment and magic items use the existing Item Composer inline, without inventory quantity or equipped state. Spells have identity, casting/components/class lists, targeting/damage/healing, benefits and review sections. Backgrounds, feats, invocations, boons, selections, languages and other references have relevant identity/rules, choices and benefit controls.

Both Compendium and Homebrew Workshop expose the same personal-entry editor. Saving stores a personal edition. Restoring the source uses the same revision checks. Existing characters retain their approved definitions until the user reviews the current/proposed values, confirms the source, and explicitly applies a revision to each character. Opening, editing or saving an entry does not itself update characters.

The public `/builder-preview` gallery contains representative populated examples for every category. Its edits and Save preview changes action are held in page memory, separate from account data; reload resets them. The link to the real Compendium requires authentication and real Save/Apply actions use that account's production data.

## Implementation

- `shared/entry-builders.ts` converts source definitions to canonical builder drafts and derives reader fields after changes. Original source data and unknown imported fields stay attached.
- `server/lib/entry-builder-schema.ts` validates typed spell, reference and monster payloads. Existing Workshop/item validation and source identity protection remain in place.
- Standard class/subclass/race features are loaded with complete rules for the editor. Source failures expose retry rather than silently omitting features.
- Shared supported benefits retain their sheet, Party, item activation, spell activation and creature semantics. Prerequisites, discretionary choices and unsupported written rules require manual interpretation; casting and combat resolution remain explicit.
- Personal edits participate in the latest server-side browse index and its revision invalidation. The view does not download complete lists of saved edit payloads for each page.

## Isolation and preservation

Candidate: `.preview.local/compendium-builders-20261023/source`.

Baseline: `dpl_EeZAqQqzPGEtTUm8hsk2XKHWVY19` (325 uploaded source inputs), including the live Party feat/reference, reader/navigation/Grim Harvest, Maps and notebook releases plus Compendium paging. The final candidate has 343 inputs: 294 unchanged baseline files, 31 focused modified files and 18 added files. All uploaded hashes are audited before and after staging. The main domain remains on the baseline.

Builder changes were also merged into the dirty shared root with backups and a per-path record in `root-sync.json`. Unrelated root work remains separate from release authority. Use the isolated audited candidate for preview/release reconstruction.

## Validation

- Frontend typecheck and production build pass; isolated server typecheck passes.
- 183 tests in 17 files pass, including all-category save twice/restore, canonical round trips, preserved data, review/concurrency and latest browse cache/storage/HTTP tests.
- 21 compiled gallery browser checks cover all categories and sections, saved draft retention, spell fields, reset, 390px/320px layouts and no account writes or runtime errors.
- 12 compiled editor checks cover all-category editing, source restoration, stale-save recovery, explicit per-character review, Workshop entry point, mobile/touch, focus, retry and rapid reopen.
- 11 compiled benefit checks cover typed controls, canonical persistence, imported-field preservation, grants, sheet/Party calculations, typed damage resistance, spell activation and narrow layouts.
- Hosted gallery, API protection and full uploaded-source audit recorded in `staged.json`, `preview-results.json`, `published-files.json` and browser result files beside the candidate.

No production account data was written by validation. No deployment was promoted to the main domain. Recheck the current live deployment before any later promotion; reconstruct from a newer baseline if production has advanced.

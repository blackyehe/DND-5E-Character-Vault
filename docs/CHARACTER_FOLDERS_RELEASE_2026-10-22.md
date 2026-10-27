# Character folders publication — 22 October 2026

The user approved the full-width explorer-tree preview and explicitly authorised publication. Published at https://dndoldal.vercel.app.

- Ready production deployment: `dpl_heD3Sm813eH73asSXWjun5yLg6dz`.
- Deployment URL: https://dndoldal-m4a2x00l3-dndenjoyerstudio.vercel.app.
- Previous production: `dpl_2hbHphdcQmgFpickk8Pi96dFAj9L`, https://dndoldal-jv4prw24b-dndenjoyerstudio.vercel.app.
- Status: promoted; the public alias was verified against the Ready deployment.

## Behaviour

The personal Dashboard opens as a full-width folder browser. Users create nested campaign folders, drag characters into them, or use Organise for selection and keyboard/touch moves. Choosing a character opens the existing sheet beside the collapsible chooser. Back to folders restores browser scroll and focus. Reload begins in the folder browser; explicit character links still open their sheet.

Folders belong to the authenticated account and save independently of character sheets. Revision checks prevent simultaneous updates from overwriting each other. Existing characters are initially Unfiled and remain visible under All characters. No existing sheet or assignment data is migrated or modified. Character exports/backups do not yet include folder organisation.

## Source isolation and regression recovery

The release starts from all 263 source files of the then-current production deployment, verified against their Vercel content hashes. Only nine folder-feature application files are added/changed: `shared/character-library.ts`, `server/models/CharacterLibrary.ts`, `server/routes/character-library.ts`, `server/app.ts` (route import/mount only), `src/composables/useCharacterLibrary.ts`, `src/components/characters/CharacterFolders.vue`, `src/components/characters/character-folders.css`, `src/components/characters/CharacterRoster.vue`, and `src/views/DashboardView.vue`.

The current production audit and room tests revealed that a deployment after the accepted Party release had omitted that feature. This release restores the ten already approved files from the verified Party release snapshot documented in [the Party release notes](PARTY_DASHBOARD_RELEASE_2026-10-22.md). Inspection confirmed that the corresponding production differences were the missing Party integration, endpoint, and sheet-section exposure. Newer Maps, notebook, monster-library, and other production files are preserved.

There are 19 documented application changes and 275 deployment input files in total. No baseline files are missing. Local credentials, environment files, tests, review scripts, and screenshots are excluded. No Git commit, PR, or remote Git push is involved. The extensive unrelated working-copy edits remain untouched.

The exact source, baseline, manifests, and test artifacts are retained under ignored `.preview.local/character-folders-release-20261022/`. Future publication must reconcile against current production; blanket deployment from the shared checkout can still omit newer live features.

## Validation

- Isolated frontend build/typecheck and server typecheck passed. The server dependency installation follows production's lockfile, including the existing Maps `sharp` dependency absent from the shared checkout's installed dependencies.
- All 23 focused tests passed. An initial regression run failed because the production baseline lacked the previously published Party implementation; restoring that verified implementation resolved those failures.
- Browser checks against the compiled release and local API passed: no automatic sheet/detail requests; full-width browsing; keyboard opening/return and focus restoration; reload behaviour; browser and sheet geometry from 320 to 1440 pixels; no uncaught errors.
- Rendered folder creation and character movement saved successfully; character sheet data and timestamps were unchanged; a genuine stale revision returned 409. Only synthetic local fixture data was touched, then restored.
- The restored Party implementation passed its existing browser interaction suite, including combat disclosures, polling, sheet navigation/return, HP/temp HP, slots/resources, conflict recovery, explicit party inclusion, and empty-party persistence. Synthetic local state was restored.
- Deployment source audit confirmed every production source hash outside the documented changes remained unchanged.
- Vercel build passed. The protected staged deployment passed authenticated CLI health and unauthenticated folder-access checks before promotion; its uploaded 275 source hashes exactly matched the approved release. The public alias was checked for concurrent changes immediately before promotion.
- Public smoke checks passed after promotion: health, folder/Party authentication boundaries, shipped folder-browser code/styles, restored Party dashboard and retained Maps/notebook navigation, plus desktop/mobile login rendering without overflow or uncaught errors.

Authenticated production writes are intentionally not part of smoke verification. Actual saves are verified against the identical compiled release with synthetic local records; production smoke checks cover shipped assets, authentication boundaries, health, and desktop/mobile login rendering.

## Rollback

```powershell
npx.cmd vercel rollback dpl_2hbHphdcQmgFpickk8Pi96dFAj9L --scope dndenjoyerstudio --yes
```

This restores the immediate previous application, including its missing-Party regression. Saved folder data remains in its separate collection and is not deleted by an application rollback. No rollback has been performed.

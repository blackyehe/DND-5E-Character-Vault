# Party dashboard publication — 22 October 2026

Published with the user's explicit authorisation at https://dndoldal.vercel.app.

- Ready deployment: `dpl_CqpazgwkxLJ1DjtoJwT2k6wMYmAD`.
- Deployment URL: https://dndoldal-2j0zuy6m2-dndenjoyerstudio.vercel.app.
- Previous production retained: `dpl_6V52nXzdTVXaqTYbdRNvFYS6UqNe`, https://dndoldal-eegbuf3vf-dndenjoyerstudio.vercel.app.
- No Git commit, PR, or remote Git push was made. Publication used the authenticated Vercel CLI for the existing project.

## Published behaviour

DM rooms open on the accepted refined Party dashboard, with explicit party selection, useful vitals, expanded saves/skills/proficiencies and combat references, and existing safe play actions. Opening a sheet retains the collapsible character chooser on the left and gives the sheet the remaining width. Return to Party restores the dashboard's state and focus. Player sheet access, Campaign notebook, and the newer production Maps section remain available.

## Release isolation

The shared checkout contains substantial unrelated uncommitted work and does not exactly match current production. Deployment therefore used a separate source snapshot downloaded from the current production deployment, with every baseline file verified against its Vercel content hash. Only these ten application files were added or changed:

- `server/routes/rooms.ts`
- `shared/party-dashboard.ts`
- `src/composables/usePartyDashboard.ts`
- `src/components/party/PartyDashboard.vue`
- `src/components/party/PartyCombatKit.vue`
- `src/components/party/PartyRuleDisclosure.vue`
- `src/components/party/party-dashboard.css`
- `src/rooms.css`
- `src/views/CharacterSheetView.vue`
- `src/views/RoomView.vue`

The room integration combines the dashboard with production's newer Maps navigation, map draft/save guards, notebook-entry links, and direct section URLs. The other production source files were retained byte for byte. The shared checkout's unrelated changes were neither reverted nor included merely because they were present.

The final source, baseline and deployment manifests, browser scripts/results, and screenshots are retained in ignored `.preview.local/party-release-20261022/`. The integrated RoomView in that release snapshot includes production Maps changes absent from the shared root's RoomView. Future releases must start from current production or reconcile those changes; a blanket deployment from the shared root could remove existing features. Do not rerun the preparation script over the verified snapshot.

## Verification

- Isolated release frontend typecheck/build and server typecheck passed.
- All 14 focused dashboard tests passed against the isolated source.
- Browser checks against the compiled release and its local API passed: authentic login, saves/skills/attacks, details/search, polling without redundant detailed reads, navigation/focus/scroll restoration, real HP/temp HP/slots/resources writes, and a genuine HTTP 409 conflict without replay. Only synthetic local records were changed, and their original values were restored.
- Sheet geometry checked at 1440, 1024, 834, 760, 390, and 320 pixels. Character and sheet-section switching, collapse/expand keyboard focus, sticky roster clearance, Maps/notebook navigation, and direct map/character section URLs passed. No page overflow or uncaught browser errors occurred.
- T3 snapshots failed twice with `Preview automation snapshot timed out after 15000ms.` The permitted fallback was an independent local headless Edge context.
- Deployment input audit confirmed 266 source files, with exactly the ten intended changes relative to production and no missing baseline files. Local credentials, environment files, tests, and review artifacts were excluded.
- Vercel build/typecheck passed. The staged production deployment returned `{"ok":true}` before promotion. The public alias was rechecked for concurrent changes before promotion and resolved to the new Ready deployment afterwards.
- Public smoke checks passed: health HTTP 200, dashboard API HTTP 401 for unauthenticated requests, shipped refined dashboard and wide-sheet styles, retained Maps navigation, and desktop/mobile login plus room authentication redirect without browser errors.

Authenticated production character interactions were not exercised; those checks used the identical compiled release with local synthetic records. No production character, resource, assignment, map, or notebook data was changed. This release requires no data migration or new dependency. The earlier unrelated full-suite Dagger expectation failure remains historical; the full suite was not repeated for publication.

## Rollback

```powershell
npx.cmd vercel rollback dpl_6V52nXzdTVXaqTYbdRNvFYS6UqNe --scope dndenjoyerstudio --yes
```

This restores the preceding application deployment, including compressed-pack and Maps support. It does not rewind saved character or campaign data. No rollback was performed.

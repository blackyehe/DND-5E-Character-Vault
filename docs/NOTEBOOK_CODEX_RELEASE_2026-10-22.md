# Campaign Codex production release — 22 October 2026

Deployed with the user's explicit approval to https://dndoldal.vercel.app/.

- Current deployment: `dpl_CFJdFLoYZy5vdC7qvkJ7qfjEwYjK` (`dndoldal-6z2f2t8ni-dndenjoyerstudio.vercel.app`).
- Previous deployment: `dpl_HYT8uwL4UXjhRwWssuWmWgbKCp7W` (`dndoldal-ochmejt40-dndenjoyerstudio.vercel.app`).
- Live notebook: https://dndoldal.vercel.app/rooms/6ad4ffe84cfe4585ee91134a?section=notebook

## Released behavior

The approved subject-first Library replaces geographic browsing, with People, Places, Objects & clues, Groups, Sessions and Bookmarks. Folder management and inherited sharing remain in DM-only Folder settings. Places show descriptions and accessible connections. Place editors support uploading, replacing and removing an image behind the title, with reduced opacity and a theme-colored fade. Images follow the entry's existing permissions. Existing animations, reduced-motion settings and the approved site-wide loading/scroll stability changes are included.

Whole-entry visibility remains in effect. No campaign entries, relationships or images were created during deployment. All 39 live entry titles, body SHA-256 hashes, audiences, selected-character permissions, folder IDs and revisions match the pre-release snapshot. The local preview's Amdurnu entry remains local.

## Source isolation

The working checkout contains unrelated ongoing work and predates newer production Maps/city-library functionality. Release source was therefore reconstructed from the existing production deployment and overlaid with only the approved notebook and stability changes. The release retained Maps, city libraries, Party dashboard and character folders. All 302 uploaded source hashes were checked against the intended manifest: 28 changed/new files, zero unrelated changes. No commit or push was made.

Release source and verification artifacts are under `.preview.local/notebook-codex-release-20261022/`; this directory is excluded from deployment. The saved source does not contain credentials.

## Verification

- Isolated frontend build/typecheck and backend typecheck passed; production frontend includes 311 modules.
- 33 focused tests passed across notebook metadata, image validation, folder permissions, actual notebook routes and shared loading/navigation behavior.
- Vercel build passed. Staged health returned 200 and unauthenticated notebook access returned 401 before promotion.
- Checked that the live alias still referenced the previous deployment immediately before explicit promotion. After promotion, the public alias resolves to the new READY deployment; public health is 200 and unauthenticated notebook access is 401.
- Authenticated live DM browser loaded all 39 entries: 18 People, 8 Objects & clues, 1 Group, 12 Sessions, 0 Places. Maps and Party dashboard navigation remain present. No local-preview banner or Geography browser appears.
- Fade and Volenta previews each returned only `Ősi Elemek Könyvei`, with private entry detail requests rejected as 404. Player preview hides editing and folder controls.
- Opened a new Places draft, verified the JPG/PNG/WebP upload control, then cancelled and discarded the unsaved draft. No production write was used to test images; image processing/save/remove/ACL/responsive checks had already passed on disposable local fixtures.
- Initial automated concurrent detail requests encountered transient 503 responses logged as `MongooseServerSelectionError`. Every failed entry succeeded on sequential retry and all 39 records matched the baseline. No further runtime errors were recorded between 20:35:30 and 20:37:44 UTC. This release does not alter the existing database connection infrastructure.
- Live screenshot automation timed out; DOM/browser checks passed. Visual and responsive image/header checks were performed locally before release.

## Rollback

To restore the previous code deployment, run from the linked project with its existing authenticated CLI:

```powershell
npx.cmd --no-install vercel promote https://dndoldal-ochmejt40-dndenjoyerstudio.vercel.app --scope dndenjoyerstudio --yes
```

Rollback changes application code only. There was no data migration to undo. Existing notebook text and sharing are not rewritten by either deployment.

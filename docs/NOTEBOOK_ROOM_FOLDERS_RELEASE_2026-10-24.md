# Notebook room-wide folders release — 2026-10-24

Live at https://dndoldal.vercel.app: `dpl_8ZCgi9ATb5BTbhefo1i88w2mpknB` (immutable `https://dndoldal-2ax9i0a18-dndenjoyerstudio.vercel.app`, runtime `fra1`). Public alias and checks verified at 09:22 UTC.

Folders are shared with the whole room and retain their names and hierarchy. Folder creation/editing has no audience selector. Entry visibility, character-specific entry sharing, tag filters, quest/clue visibility and DM-only folder management are preserved. Removing folders does not delete entries or hide them. No production notebook data was read or written for this release.

The user's approved preview is documented in `NOTEBOOK_ROOM_FOLDERS_PREVIEW_2026-10-24.md`. The expired Vercel session was refreshed through the existing CLI login without user credential input. The current live baseline was then reverified as `dpl_9cqV9sKADmJTco9R8po8ruJiSZdD`; every one of its 359 source input hashes matched the audited baseline. Only six approved files changed, with all other 353 preserved byte-for-byte. All 359 staged deployment inputs matched the expected hashes before promotion.

Changed files: `shared/notebook.ts`, `shared/notebook-folders.ts`, `server/lib/room-library-access.ts`, `server/routes/notebook.ts`, `src/components/notebook/CampaignNotebook.vue`, `src/components/notebook/NotebookFolderFields.vue`.

Current entry visibility controls, Maps/city-library integration, prepared Compendium flags and schemas, version grouping, Gallery and ability-score placement remain preserved. The dirty root checkout was not deployed wholesale.

Validation: frontend typecheck/build and server typecheck passed; 63 focused tests passed. Seven compiled browser checks passed locally and again with staged/public hosted application assets, using disposable local API fixtures for notebook operations. Folder create/edit, current entry visibility controls, player scope, desktop/390px/320px layout and removal confirmation passed without uncaught browser errors. These were fixture walkthroughs, not authenticated production notebook walkthroughs.

Staged and public HTTP checks: health/homepage 200; unauthenticated notebook, character and Compendium APIs 401; removed operator endpoint 404; desktop/mobile login redirect/render passed. Hosted chunks retain the approved notebook UI, Compendium version selectors and ability placement.

Promotion was requested once. The first immediate alias lookup still returned the previous deployment during propagation; subsequent public checks and a separate checkpoint confirmed the new deployment. No duplicate promotion was issued.

Source synchronization: six files in the combined checkout matched the original production baseline and were updated with hash guards. Four root files already matched the release. Root `server/routes/notebook.ts` and `CampaignNotebook.vue` have preexisting differences and were preserved; use the audited release source for future integration. No unrelated files were overwritten and no Git commit was created.

Evidence: `.preview.local/notebook-room-folders-release-20261024/` (manifests, exact input audit, staged/public checks, screenshots, promotion and guarded sync). Original preview/test evidence remains in `.preview.local/notebook-room-folders-20261024/`.

Rollback deployment: `dpl_9cqV9sKADmJTco9R8po8ruJiSZdD`. It restores folder-level restrictions. No database rollback is required because there were no data writes.

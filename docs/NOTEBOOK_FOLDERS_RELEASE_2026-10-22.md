# Notebook folders — 2026-10-22

Released to https://dndoldal.vercel.app using verified deployment `dpl_HqVqyhnBW3ymmfgacrgkMVfa6QWe` (`dndoldal-bzoswbsof-dndenjoyerstudio.vercel.app`).

## DM controls

- Folders support parent folders within the same notebook section.
- Each folder and entry has independent sharing: DM only, Whole room, or Selected characters. New folders default to DM only.
- Players need access to an entry and every ancestor folder. Private ancestors hide folder names, entries, direct reads, history snapshots, links, and notebook information exposed through map pins.
- Only the DM manages folders or moves existing entries between folders. Folder edits reject cycles, unavailable parents, and stale revisions.
- Deleting a folder does not delete its entries; the DM can recover or move those entries.
- Sharing applies to the entire entry. Individual paragraphs do not have separate visibility controls.

## Release isolation

The deployment was built from the current production source snapshot with nine documented notebook-related file overlays. All 270 uploaded source hashes matched the audited manifest. The public alias was checked immediately before promotion to avoid overwriting a concurrent release. Unrelated working-tree changes were excluded.

The existing production Maps feature and notebook `initialEntry` navigation were preserved. Production-only `server/routes/room-maps.ts` uses `notebookScope` for pin lookup so hidden folders cannot leak notebook titles. This Maps route remains in the isolated release source; it was not copied into a working tree that lacks the rest of Maps.

Release inputs, original files, hash manifests, screenshots, deployment IDs, browser checks, and promotion verification are in `.preview.local/notebook-folders-release-20261022/`.

## Validation

- Frontend and server typechecks passed; isolated production frontend build passed.
- Ten focused tests passed, covering folder access helpers and mocked HTTP boundaries.
- Local Mongo transactions and compiled UI checks passed for private ancestors, selected-character sharing, independent entry privacy, default-private folder creation, stale revisions, cycles, direct access, and map pin privacy.
- Browser checks at 320–1440px passed without browser errors. Nested indentation computed to 8px, 20px, and 32px.
- Live Revalon organization read back every approved body and preserved DM-only entry sharing. Fade and Volenta previews returned 404 for all seven saved entries, with entries and private folders absent from their indexes.

## Campaign organization

- Journal: `Sessions`; `Xalan'Gor / Amdurun / Bill Clinton műhelye`; `Xalan'Gor / Amdurun / Wren's Library`.
- Story items: `General Items`; `Books and Notes`.
- Six previously approved entries were moved without body changes. The approved minimal Haalan book entry was saved. All seven folders and seven entries remain DM only.
- The skipped monster book was not created. Every later proposal still requires individual content approval.
- Review records: `backups/revalon-notebook-review-2026-10-22/FOLDER_ORGANIZATION_VERIFIED.json` and `proposals.json`.

## Rollback

Previous public deployment: `dpl_8AgXuPqDP8PuEhVc92datBg6Mzfe` (full metadata in `previous.json`). The old application lacks ancestor folder visibility enforcement. Before any application rollback, ensure entries under private folders also have suitable entry-level restrictions; otherwise rolling back could reveal folder names or contents. This campaign currently has DM-only restrictions on every saved entry. Prefer a forward fix retaining folder access enforcement.

Promotion changes the application alias, not notebook data. No Obsidian source notes were modified.

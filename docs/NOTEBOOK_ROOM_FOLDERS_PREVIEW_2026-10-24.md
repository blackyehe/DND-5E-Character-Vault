# Notebook folders shared with the room

Implemented the user's request to remove folder-level hiding while retaining folders for organization. The approved preview is now live; see `NOTEBOOK_ROOM_FOLDERS_RELEASE_2026-10-24.md` for release and verification details. The following records the original preview work.

Folders now use whole-room visibility regardless of legacy folder audience fields. Folder creation/editing offers only name and parent. Folder management remains DM-only; players can browse active folders. Existing entry visibility, character assignment checks, tag filtering, quest/clue visibility, text history and revision checks remain in place.

Entry access no longer depends on folder placement, including deleted/missing folders. This applies to lists, counts, tags, search, bookmarks, details, revision polling, history snapshots, connections, link targets, map pins and city-library references. History still checks each saved snapshot's entry audience. Removing or recovering a folder does not change or delete entries. Players can continue editing accessible notes after an obsolete folder is removed.

Legacy clients may still submit folder audience fields; the server accepts their existing shape but stores room visibility and an empty character list. Legacy saved folder audiences are ignored and normalized in responses. No production data migration or writes were performed.

## Preview and validation

- Disposable sample preview: http://localhost:5220/rooms/111111111111111111111111?section=notebook
- Evidence/source: `.preview.local/notebook-room-folders-20261024/`
- Frontend typecheck and build passed against the isolated production snapshot with the focused patch.
- Server typecheck passed using the existing combined checkout's dependencies (including Maps' `sharp` dependency).
- 63 focused tests passed, including entry privacy under legacy private folders, both player assignments, preview restrictions, removed-folder editing, history, metadata, references and the preserved live entry-sharing endpoint.
- Seven compiled browser checks passed: folder create/edit, existing entry visibility controls, player folder access with private entries absent, desktop/390px/320px layouts, removal confirmation and no uncaught errors.
- T3 snapshots timed out twice; local Edge/Playwright fallback was used. Screenshots and results are saved with the evidence.

## Integration

The dirty root checkout predates production's quick entry-visibility controls. The canonical integration is the isolated `source/` directory, not a wholesale copy of root. It preserves the production sharing route, UI and dirty/conflict guards, removing only its obsolete inherited-folder notice. `integrate.py` applies the folder edits onto the verified baseline. `finalize.mjs` audits all original deployment inputs and checks that entry-sharing tools remain present.

Baseline: last verified live release `dpl_9cqV9sKADmJTco9R8po8ruJiSZdD`. Of its 359 deployment inputs, 353 are unchanged; six contain the focused patch. The isolated tests are additional local evidence, not deployment inputs. Review patch: `review.patch`.

The current-production lookup returned Vercel `403 forbidden`; current alias freshness could not be established. No deployment or promotion was attempted. Before any future rollout, obtain current deployment access, reconstruct from the then-current production source and apply this focused patch, preserving concurrent work. Do not promote this snapshot directly without that check.

Root has the corresponding folder changes and regression tests; unrelated dirty work remains untouched. No Git commit was created.

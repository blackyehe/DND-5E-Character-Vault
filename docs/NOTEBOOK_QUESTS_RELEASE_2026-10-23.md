# Campaign notebook Quests release

Released 23 October 2026 (Europe/Budapest).

Production: `dpl_BJFvzh5NtHmHmGcnxktWmTxZ44Dk` — https://dndoldal-6qhckyzgu-dndenjoyerstudio.vercel.app

Previous production: `dpl_3ahivW3KCmEZ4JWX6zTjjAR7WYVv` — https://dndoldal-hbp60wtos-dndenjoyerstudio.vercel.app

## Changes

The Library includes Quests with Active and Finished filters and counts. The DM can create quests, mark them finished and return them to Active. Finished can cover completed, failed or abandoned outcomes; the description records the result. Quests always use Whole room sharing with no folder or selected-character restriction. Only the DM manages quest content and status. NPC and place Connections can include Related quests; private connected entries remain hidden from players.

Existing notebook entries were not converted, rewritten or shared. Every new quest still needs individual content approval. Bill Clinton's workshop deal is the first pending proposal; the live Quests tab starts empty.

## Release isolation

The working checkout predates some live Maps and Party work and contains unrelated edits. Reconstructed the current production source, then overlaid exactly seven notebook source files. Audited all 303 uploaded SHA1 values against the baseline plus those changes. Maps, city libraries and Party work were preserved. No commit or push was made. Source, before/after content snapshots and deployment evidence are under `.preview.local/notebook-quests-release-20261022/`.

## Validation

- Isolated frontend build/typecheck passed (312 modules); backend typecheck passed.
- 30 focused shared/API tests passed, covering room sharing, DM-only writes, hidden links, revision conflicts, status restoration, filtering and pagination. All 10 preview-model tests passed.
- Local browser checks covered Active → Finished → Active, correct counts, stable document scroll and reader geometry, fixed sharing in the editor, and default Active/room/unfiled values after saving a disposable local quest.
- Fade and Volenta previews both read the Active and Finished fixtures with no management controls; private links disappeared. A 390px iframe check found no horizontal document overflow and readable reader/status controls. Screenshot automation timed out, so these checks used DOM content and geometry.
- Staged source hashes matched all 303 expected files. Staged health returned 200 JSON and unauthenticated notebook access returned 401. The public alias remained on the baseline until explicit promotion.
- Public deployment is READY; health returned 200 and unauthenticated notebook access returned 401. Authenticated live UI shows Quests, New quest, Active/Finished filters and the empty Active state; Maps remains present.
- Sequentially reread all 49 existing entries. Titles, bodies, revisions, sharing, folders, links, metadata and cover-image SHA256 values matched before release. The only added response field is nullable questStatus. No campaign data writes or migrations were performed by this release.
- Live Fade and Volenta previews retain only the previously shared book. Quest counts are Active 0 / Finished 0 for DM and both previews.

## Rollback

From the linked project using the existing authenticated CLI:

```powershell
npx.cmd --no-install vercel promote https://dndoldal-hbp60wtos-dndenjoyerstudio.vercel.app --scope dndenjoyerstudio --yes
```

Rollback changes code only. No data migration needs reversal.

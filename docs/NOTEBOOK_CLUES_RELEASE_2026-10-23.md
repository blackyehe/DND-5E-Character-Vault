# Quest clue tracker release

Live deployment: `dpl_EyfrzLzqY9QyH3LFZJrBsMQ2QQGf` — https://dndoldal-2fn4svz93-dndenjoyerstudio.vercel.app

Previous deployment: `dpl_BJFvzh5NtHmHmGcnxktWmTxZ44Dk` — https://dndoldal-6qhckyzgu-dndenjoyerstudio.vercel.app

## Behavior

Each quest has a Clues tab. The DM adds a clue through Edit / Clues, with a title, optional Markdown description and session numbers. Clues default to DM only. Each saved clue has a Show to players / Hide from players action. Quests stay room shared, including Finished quests. Players cannot manage clues. The API filters private clues before returning details or performing searches; list metadata never contains clue text, IDs or hidden counts. Text restoration preserves the current clues and their visibility, and older clients omitting clues cannot erase them.

The user approved Bill Clinton's quest separately. Saved as Active / Whole room, session 12, entry `6ada8919648da4781dfdecb9`; both player previews read it with private NPC/place/crystal connections hidden. This increased live entries from 49 to 50 before the code release. No production clues were added. Every later campaign entry or clue remains subject to individual approval.

## Verification

- Frontend build and typecheck passed in an isolated copy of current production (317 modules). Backend typecheck passed.
- 32 focused shared/API tests and 11 preview-model tests passed. Coverage includes private-by-default clues, individual reveal/hide, hidden IDs/text/search/history, DM-only mutations, preview restrictions, session validation, limits, revision conflicts, legacy clients and text restoration.
- Disposable local browser checks saved a new clue with sessions 12 and 14, confirmed the DM-only default, and exercised reveal then hide. The reader rectangle, selected Clues tab, document scroll and reader scroll remained unchanged on reveal.
- Fade and Volenta local previews showed only the shared clue and no management controls. A 390px iframe displayed all four tabs and clue sources within the viewport, with no horizontal document overflow. Validation used DOM content and geometry; no screenshot comparison was performed.
- Reconstructed current production and overlaid exactly eight source files (five modifications, three additions). All 306 staged source SHA1 values matched the audited input manifest. Existing Maps and Party work was preserved. No commit or push was made.
- Staged health returned JSON 200 and unauthenticated notebook access returned 401. Confirmed the public alias remained on the baseline before explicit promotion. Live alias is READY, health is 200 and unauthenticated notebook access is 401.
- Authenticated live quest reader shows Description / Clues / Encounters / Connections, with the expected empty clue state. Existing Maps navigation remains present.
- Sequentially reread all 50 entries after release. Titles, bodies, revisions, sharing, folders, links, status, metadata and cover-image SHA256 values match the pre-release snapshot. The only new detail response field is questClues; no campaign data migration was performed.
- Both live player previews retain the approved Bill quest and the previously shared book, with no private connections or clues exposed.

Source, manifests and verification evidence: `.preview.local/notebook-clues-release-20261023/`. The separate disposable preview is on port 5185; the user's original port 5182 preview was preserved.

## Rollback

Promote the previous deployment using the authenticated Vercel CLI:

```powershell
npx.cmd --no-install vercel@65.1.0 promote https://dndoldal-6qhckyzgu-dndenjoyerstudio.vercel.app --scope dndenjoyerstudio --yes
```

Rollback affects code only. Saved clues remain in the database, and the older client preserves them when it omits the field. The approved Bill quest remains saved.

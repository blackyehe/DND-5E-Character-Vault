# Codex tags and encounter session links release

Live deployment: `dpl_D4FLb9CXGtiY4V8GpoLWXirE5XY3` — https://dndoldal-rohindgkj-dndenjoyerstudio.vercel.app

Previous deployment: `dpl_Aq4gz63cPu3zwH79uwUN77UkUHzr` — https://dndoldal-du719bwad-dndenjoyerstudio.vercel.app

## Behavior

Encounters links session references to a unique accessible session entry, including bold labels, number lists, ranges and Session N notation. The existing Back action returns to the original entry and Encounters tab. Missing, private or ambiguous targets remain text. Stored Markdown is unchanged.

The DM can create, reuse and remove custom tags in Edit. Tags support arbitrary labels such as Amdurun or Magellan, including commas within a label. The Library has a collapsible, searchable tag filter; multiple selections require all selected tags. Clicking a reader tag opens All entries filtered by that tag. Tags carry across category changes. Each entry permits 20 tags of up to 48 characters; whitespace and duplicate spelling are normalized.

Players see tag suggestions and counts only from accessible entries. Tags never grant access. Players cannot change tags, including through direct API calls. Legacy edits and text restoration preserve tags. No live campaign tags were assigned; future classifications remain subject to the user's individual approval.

## Verification

- Frontend build and typecheck passed against an isolated copy of current production (323 modules); backend typecheck passed.
- 38 shared/API tests across six files and 12 preview-model tests passed. Checks cover permissions, ancestor-private and deleted entries, tag filtering before pagination, custom labels, normalization, stale revisions, validation, legacy edits and restoration, and session lists/ranges/missing/ambiguous targets.
- Disposable local browser checks exercised session links and Back navigation, adding and saving a fully custom tag, single and multiple tag filters, category filtering and reader-chip navigation. Fade and Volenta previews excluded the private Magellan tag and exposed no tag management. Private sessions remained unlinked.
- A 390px iframe showed tags, encounter links and the expanded filter with no horizontal document overflow. Clicking Amdurun showed four fixtures across People, Places and Quests. Browser validation used DOM content and geometry; no screenshot comparison was performed. The user's original port 5182 preview was preserved.
- Reconstructed the latest production deployment and overlaid exactly ten source files (six modifications, four additions). All 310 staged source hashes matched the audited manifest. Existing Maps and Party changes were preserved; unrelated root changes were excluded. No commit or push was made.
- Staged and live health returned JSON 200; unauthenticated notebook access returned 401. Confirmed production still matched the baseline immediately before promotion. The public alias now resolves to the READY deployment above.
- Authenticated live Ashton encounter references opened Session 6, and Back restored Ashton with Encounters selected. The live editor includes Add tag; canceled without writing. Existing Maps navigation remains present.
- Sequentially reread all 50 entries after promotion. Titles, body and cover-image SHA256 hashes, revisions, audiences, folders, connections, session sources, quests, clues and metadata match the pre-release snapshot. The only new detail field is an empty tags array. No data migration or campaign writes occurred.
- Both live player previews retain exactly the approved Bill Clinton quest and shared book, with no private session targets or tags.

Source manifests, content hashes and verification evidence: `.preview.local/notebook-tags-release-20261023/`.

## Rollback

Promote the previous deployment above using the authenticated Vercel CLI. This release does not migrate campaign data; any subsequently saved tags remain in the database.

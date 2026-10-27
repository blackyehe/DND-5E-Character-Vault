# Contextual notebook editing and quest preparation

Live deployment: `dpl_sojfggK4oq8SwWB2ipJ8GynhJV26` — https://dndoldal-8a54q1kdm-dndenjoyerstudio.vercel.app

Previous deployment: `dpl_D4FLb9CXGtiY4V8GpoLWXirE5XY3` — https://dndoldal-rohindgkj-dndenjoyerstudio.vercel.app

## Behavior

Description/Overview, Encounters and Connections include contextual editing actions. The header Edit action also targets the current tab. These open the existing editor, focus the relevant text or connection controls, and return to the originating tab after Save or Cancel. Encounters positions the caret at its Markdown section, creating an empty Session-kapcsolat heading in the unsaved draft when needed. Reader and document scrolling remain bounded.

Clues has Add clue and per-clue Edit clue actions. Add clue opens a new unsaved DM-only clue in the editor and focuses its title. Edit clue focuses the chosen clue. Nothing is saved until Save changes; Cancel retains the existing discard confirmation. Visibility controls and the existing clue count limit still apply.

The latest user instruction replaces the earlier requirement that all quests be permanently room-shared. New quests now default to DM only. Quests can be DM only or Whole room, remain unfiled and DM-managed, and retain independent Active/Finished status. The reader provides Show to players / Hide from players; Edit includes the same audience choices. Existing quests retain their current audience.

A private quest hides its title, tags, counts, clues, connections, search results and history from players. Revealing it exposes only Whole room clues. Hiding it again hides every clue without changing individual clue audiences. Text restoration preserves the current quest audience.

## Verification

- Frontend build and typecheck passed on isolated current production (323 modules); backend typecheck passed.
- 39 shared/API tests across six files and 13 preview-model tests passed. New coverage creates a private quest, checks both players, search/tag/count/bookmark/direct/history/connection exclusions, reveals it with one public and one private clue, hides it again, restores text, and verifies revision and preview-write protection.
- An initial root test command also discovered copied backup suites that lack dependencies. Verification was rerun successfully in the isolated release with exactly the six intended suites.
- Local UI checks exercised Add clue, save back to Clues, per-clue editing, Cancel, encounter caret positioning, connection search focus and new-quest DM-only defaults. Document scroll remained zero. Reveal showed the prepared quest and public clue to Fade; the private clue and all management actions remained absent. Hiding again returned 404 for Volenta's direct read.
- A 390px iframe added a second private clue, focused the new title, saved back to Clues and retained document scroll zero, with no horizontal document overflow (379px client and scroll width). Screenshot capture timed out; validation used DOM content, focus and geometry.
- Reconstructed the latest production baseline and changed exactly five source files. All 310 deployed source hashes match the audited manifest. Existing Maps/Party changes and unrelated root changes were preserved. No commit or push was made.
- Staged/live health returned JSON 200; unauthenticated notebook access returned 401. Confirmed the public alias matched the baseline immediately before promotion.
- Live approved Bill Clinton quest retains Whole room sharing and shows the new Hide from players and Add clue controls. No live content or visibility mutations were performed.
- Sequentially reread all 50 entries after release: all fields, body and cover-image hashes, audiences, revisions, tags, sources, links, status and clues exactly match the pre-release snapshot. Both live player previews retain the same two readable entries and the Bill quest remains public with no clues or private connections exposed.

Evidence and isolated source: `.preview.local/notebook-actions-release-20261023/`. Disposable preview: port 5187; the user's original port 5182 state was preserved.

## Rollback

Promote the previous deployment above with the authenticated Vercel CLI. No migration was performed. Private quests saved after release remain private in the database; the previous API cannot edit private quests until this feature is restored or they are revealed using the new version.

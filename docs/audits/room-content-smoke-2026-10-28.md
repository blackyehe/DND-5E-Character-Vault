# Live room content smoke check — 28 October 2026

Follow-up: the imported-item selection gap and related class/reference issues are addressed in [the imported-content availability audit](imported-content-availability-2026-10-28.md). The results below describe the preceding release and the original finding.

The user requested a quick live test focused on adding new local content to game rooms. This check used `https://dndoldal.vercel.app`, two separate authenticated desktop Edge browser contexts, dedicated synthetic DM/player accounts, one disposable character and an isolated room. No real campaign, library or character was changed. No application code was changed or deployed.

## Results

- Saved the magic-item browsing category on the DM's device, then imported a new one-item Orcbrew pack from an independent API session. The next Compendium opening detected the old saved category and found the new item through server browsing. Navigation, category selection and search took 2,556 ms in this small fixture. Explicitly refreshing the saved category then exposed the new item's full definition on demand.
- Created a personal Workshop magic-item template, selected it through the room's actual **Give item** dialog and delivered it to the assigned character. The already-open player Equipment tab displayed it automatically, without navigation or manual refresh, 2,266 ms after starting delivery. The give request returned in 407 ms. An independent authorized player read confirmed its description and template revision.
- Updated the template's name and description through the normal item API. The server reported one updated character and zero deferred updates. The already-open player sheet displayed the changed name; a fresh player read confirmed the new description and revision. Total test-command start to visible update was 5,311 ms, including an additional synthetic-account login and process overhead; the item-edit API itself took 1,408 ms. These are single observations, not general latency guarantees.
- A player HP write succeeded in 809 ms. Replaying the old saved version received HTTP 409. A fresh DM room snapshot contained the player's saved value. The test did not separately time its rendering in the DM UI.
- The room player's reference database contained no persisted owner-sheet cache records.
- Removing the character assignment caused both quick-sheet and reference endpoints to reject that player with HTTP 404. The item disappeared from the player's already-open room as polling reconciled access.
- Neither browser emitted a JavaScript page error during the main sequence.

## Workflow gap found

The **Give item** library does **not** include imported Compendium magic items. With the imported fixture visible in the Compendium, searching its exact name in the room picker returned zero choices; searching the newly authored Workshop item returned one. `ItemComposer.vue` currently combines SRD normal equipment, SRD magic items and `/api/items` personal templates. Its labels describe that scope. It does not query imported Compendium items or their saved browsing index.

This is a gap in selecting imported content for delivery, rather than evidence of failed room synchronization. Personal Workshop item delivery and subsequent updates passed. A follow-up should connect imported item selection to an authorized full-definition read and the existing item conversion/grant validation. The saved category is a browsing index and should not itself become a complete item definition or grant authority. Avoid eagerly downloading full imported item catalogues while opening the picker.

## Scope and cleanup

This was a quick desktop smoke check with a tiny isolated library. It does not cover all spells, classes, monsters, maps, notebook workflows, network failures, or the real 126-pack library's performance. The DM and player used separate browser contexts. Imports and template edits used independent API sessions; item selection/delivery and observation used the real room UI.

The synthetic character and imported pack were removed, the player was removed from the room, and its assignments were cleared. The synthetic item was moved to Recently deleted through the supported Workshop endpoint. The empty isolated room, reusable test accounts and archived synthetic item remain confined to the test accounts; the application exposes no room/account hard-delete route. Active character, pack and item lists were verified empty after cleanup.

Sanitized browser and picker evidence is under ignored `.local/room-content-smoke-20261028/` (`browser-results.json`, `picker-results.json`). Its state file contains private generated test credentials and must not be committed. The browser scripts are disposable validation helpers, not a complete automated regression suite.

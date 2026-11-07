# Room-focused player startup — 4 November 2026

Scope: evaluate a lighter game-room entry and selected rule downloads as additional angles on initial loading. This is source inspection against the published website plus existing regression evidence, not a new performance comparison or deployment.

## What is already available

Existing members can open `/rooms/<room-id>` directly, optionally choosing a section such as `?section=characters` or `?section=notebook`. The current authentication guard preserves that destination through sign-in. The invitation URL is a separate joining workflow; players already in the room do not need to join again merely to open it.

Direct room navigation does not mount the Dashboard or run its character-list loading. However, the Dashboard is statically imported by the main router, so some non-room screen code is downloaded with the shared application even on a direct room visit. Hiding navigation links alone would not remove those downloaded bytes.

The Room view already defers Party Dashboard, character sheet, Notebook and Maps components. Ordinary players default to their character section, and their roster contains only assigned characters. The DM Party Dashboard is not mounted for a player. Notebook/Maps visibility and character assignment remain server-authorized. Compendium background library preparation explicitly pauses on room routes, so it should not be described as a whole-library download that every player currently performs.

## Selected rules from multiple packs

This approach is feasible and is already partly implemented. The room character-reference endpoint uses the DM's rule library and sends `sheetReferences` selected for the assigned character. It filters class/subclass/race identities, selected feats/options/languages and known/prepared/innate spells; it excludes raw pack trees and unrelated definitions from that reference response. Saved inventory also carries its own item data. Players do not need to choose or import the DM's entire set of source packs merely to use the assigned character.

The server-side work is a different question. `characterRuleLibrary` can compose broader required rule categories from the DM's packs before filtering the returned character references. Its prepared path excludes unrelated monster/item/source trees and requests extra categories according to character selections, but this is not an exact per-character, per-definition server read. Missing prepared components can still fall back to the original complete reader. A smaller browser response therefore does not prove that the server reads only that character's individual definitions.

A future narrower reader would need the complete dependency set, not just pack filenames: class/subclass features, racial or feature-granted spells, multiclass definitions, selected item rules, source aliases, ambiguity/precedence and revision changes. Manually asking each player to pick packs would add an unnecessary management burden and could leave rules incomplete. Existing selection and freshness behavior should remain the baseline.

The existing `server/lib/sheet-references.test.ts` covers exclusion of unrelated definitions, secondary multiclass subclasses, selected imported identities and legacy aliases. These are retained regression results and code evidence, not a newly executed full player/network test.

## Small changes worth measuring first

1. Make the current Dashboard route load its code only when visited, so a player opening a room does not automatically download that screen and its unique dependencies. Shared dependencies will remain; measure the actual initial request set and readiness rather than claiming the entire Dashboard size disappears. [Vue's code-splitting guidance](https://vuejs.org/guide/best-practices/performance) supports loading nonessential route components on demand.
2. Defer room-only DM tools until they are needed. The Room view currently statically imports the give-item composer and rule-review component even though their controls are conditional. Shared character-sheet dependencies mean the actual byte saving needs a real build. Preserve the DM's experience and all player permissions.
3. Combine that smaller entry with the [selected-page loading during sign-in](startup-options-2026-11-04.md) experiment: prepare only the room and its requested first section, then fetch the authorized character and selected references after sign-in. Keep Notebook/Maps for when requested. This reconciles preloading needed code early with avoiding unrelated code entirely.
4. Offer a direct room bookmark or a “Return to game” action. The routing already supports the destination. A simpler room-focused navigation could improve usability, but changing visible navigation alone is not a loading optimization. Treat any preferred room as a user choice, not a global player role: the same account may DM one room and play in another.

These changes can use the same website and existing room address. A separate player application, download manager or new pack distribution system is not justified by this inspection. If frontend separation later proves insufficient, a genuinely separate server path would be a different, larger experiment; the existing browser still reaches the shared backend and its startup cost.

## Recommendation and acceptance

The next focused experiment should be the small room-entry code split, measured together with requested-section preloading. Preserve normal DM navigation; verify direct room return after sign-in, ordinary player defaults, no DM authoring chunks or general library downloads before they are needed, correct selected rule references across packs, and unchanged membership/assignment checks. Record actual compressed transfer/request counts and time until the player can use their sheet. Also verify that opening Dashboard and DM tools later still works and that a missing download can recover.

No speed saving is claimed yet, and this does not establish a fix for backend wake-up/routing delays. No production data, code or hosting settings changed during this review. The manually accepted DMV-link limitation is outside this scope.

Subsequent implementation: [requested-page/explicit-section file preparation during sign-in](sign-in-page-preparation-2026-11-04.md) is now published and verified as a separate narrow release. The Room view and its data permissions remain unchanged. Dashboard/DM-tool code splitting and a room-focused entry interface are still proposals, not features completed by that release.

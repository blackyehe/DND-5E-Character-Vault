# DM party dashboard

## Current revision - published

The user accepted the refined design and its corrected full-sheet workspace, then explicitly authorised publication on 22 October 2026. It is live at https://dndoldal.vercel.app. See [the release record](PARTY_DASHBOARD_RELEASE_2026-10-22.md) for deployment, verification, release-source isolation, and rollback details. All three design iterations were built and reviewed locally; [the comparison report](PARTY_DASHBOARD_PREVIEW_REVIEW.md) retains their findings.

The sparse combat kit has been replaced by a substantial character dropdown in `PartyDashboard.vue`, `PartyCombatKit.vue`, `PartyRuleDisclosure.vue`, and `party-dashboard.css`. All six saves remain at the top; attacks are paired with skills, then combat features with proficiencies. Feature summaries are visible before expanding full rules. Slots/resources and spells follow. The layout stacks naturally on phones and uses the existing appearance system.

Current handoff:

1. The accepted refined dashboard and full-sheet workspace are published. Alternative designs remain local review artifacts.
2. Production's newer Maps navigation was preserved in the isolated release. Reconcile the release source with the shared checkout before any future blanket deployment.

Refined preview: `http://127.0.0.1:5173/rooms/6ad9c771eac2ff6eb172acbe`. The same local demo credentials work for all three previews. This new review room contains separate synthetic Fighter, Wizard, and Rogue records; the earlier demo room was preserved. An unassigned stress-test character is available through Choose party. Local API port 4012 uses loopback Mongo database `dnd_site`. The proxy preserves Host (`changeOrigin: false`) so browser logins pass the API origin check.

The room workspace opens on **Party dashboard** for DMs. Players still open their assigned sheets. Characters and Campaign notebook remain separate room sections.

## Behaviour

- Assigned characters form the default party; Shadow Champions require explicit inclusion. **Choose party** can include unassigned heroes and companions without changing assignments. An explicit selection, including an empty selection, is saved per account and room on this device. **Use assigned characters** restores the automatic default.
- Aligned rows show saved HP, temporary HP, equipment-aware AC, passive Perception, inspiration, and spell save DC for casters or speed for noncasters. Slot availability and a short resource preview stay on the overview.
- **Adjust HP** supports damage, healing, and replacing temporary HP. Damage consumes temporary HP first. Inspiration and individual slot/resource usage use the existing play-update boundary.
- **Character details** expands one member at a time. It shows ability scores/modifiers, all six saves (including active-item save bonuses), initiative, proficiency bonus, speed, hit dice remaining, skills, proficiencies, and languages. Up to eight trained skills appear by default; Show all skills exposes every modifier, including untrained checks.
- Attacks include equipped weapons and saved custom attacks. Combat features show a short rules excerpt, pinned first, with full text on disclosure. Search covers attack names/notes, feature names/rules, and available spell names/rules. All features includes noncombat traits. Slots/resources start open and may be collapsed; their controls save through the existing play boundary.
- Known/prepared spells show casting time/range where saved SRD references exist. Complete/custom references, innate spells, inventory management, and permanent editing remain on the full sheet.
- Direct links open Summary, Combat, Spells, Equipment, Features, or Proficiencies. **Back to party dashboard** restores filter, expanded rules, scroll, and exact originating focus. Sheet controls visibly disable during a save. Dropdown collapse from the bottom restores visible focus to its trigger; switching expanded characters keeps the next trigger in view.
- The full sheet fills the space beside the existing collapsible character chooser. The return bar spans both columns, and the sticky chooser stays below it. On phones, the chooser and full-width sheet stack naturally.

## Data and safety

`GET /api/rooms/:roomId/party?characters=<comma-separated IDs>` is DM-only and returns only requested characters still owned by the room owner. Batches contain at most 40 IDs; larger parties are read in batches. The response excludes biographies, original imports, and reference catalogs.

Snapshots reuse saved-sheet output, equipment AC, progression, passive Perception, and resource calculations, including saved homebrew rules. They do not load members into the singleton selected-sheet store or resolve source packs per member. A combat kit requests one quick sheet on demand. Missing/custom spell definitions remain accessible through the full spellbook.

Party snapshots refresh every 15 seconds while the dashboard and document are visible; manual refresh is available. They are not a real-time subscription. Full sheets keep the existing refresh and reference behaviour.

Writes use `PATCH /api/rooms/:roomId/characters/:characterId/play` with `expectedUpdatedAt`. In-flight snapshot reads cannot overwrite completed actions. A conflict reloads current values and asks the user to review and repeat the action; an uncertain save is never replayed automatically. Navigation waits for a pending save. No conditions, concentration, encounters, or dice state is invented.

## Original implementation review history

1. Built the snapshot endpoint, explicit party selection, safe play actions, compact combat access, and sheet navigation.
2. Inspected actual desktop/tablet/phone screenshots, including a very long name and eleven trackers. Refined aligned columns, noncaster statistics, collapsed resource density, phone touch targets, and return/focus behaviour.
3. Verified live writes and a genuine 409 conflict against a separate local Mongo database. Checked authentication, membership, assignment, ownership and revocation boundaries, empty/persisted selections, equipped attack calculations, polling, keyboard operation, reduced motion, and large text with both established light and dark appearances.

Browser widths checked: 1440, 834, 390, and 320 CSS pixels. Product-native T3 navigation/evaluation worked, but repeated screenshot timeouts and an unavailable browser fallback required an independent local Edge/Playwright context for final visual and interaction checks. No production characters were used for write tests.

## Validation

The **current redesigned preview** passes `npm run build` (including frontend typecheck), `npm run server:typecheck`, and all 14 focused party tests. Browser interaction checks cover genuine saves/conflicts, sheet navigation/return, polling, selection, and keyboard operation. Responsive stress checks cover 1440, 834, 390, and 320 pixels, four themes, large text, reduced motion, 18 trained skills, long names, and 11 custom resources plus automatic resources. See the review report for detail. The older full-suite result below is historical; it was not rerun for this frontend revision.

- `npm run build` and `npm run server:typecheck` pass.
- The new snapshot/action and endpoint tests pass: 14 cases across `shared/party-dashboard.test.ts` and `server/routes/rooms-party.test.ts`.
- Full suite: 127 passed, 1 skipped, 1 pre-existing failure. `src/lib/character-builder.test.ts:71` expects a Dagger without `index: 'dagger'`; the existing builder includes that field. This also fails alone, and neither builder source nor its test was changed.
- Start or restart the local API after updating the checkout so the new party endpoint is loaded. No schema migration or new dependency is required.

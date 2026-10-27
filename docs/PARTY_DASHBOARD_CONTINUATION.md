# Party dashboard continuation brief

## Status and authorisation

The user accepted the refined dashboard and corrected full-sheet workspace, then explicitly authorised publication on 22 October 2026. The feature is live at https://dndoldal.vercel.app; see [the release record](PARTY_DASHBOARD_RELEASE_2026-10-22.md), [the current implementation](PARTY_DASHBOARD.md), and [the preview comparison report](PARTY_DASHBOARD_PREVIEW_REVIEW.md). The isolated release preserves newer Maps work from production; reconcile that source before future blanket deployments from the shared checkout. No Git commit, PR, or Git push was made. The remainder of this document is the archived task specification; its preview-only scope, requests for future iterations, and incomplete/unverified descriptions are historical, not outstanding work.

The user wants **2–3 iterations of different design choices**. Plan for three meaningful designs, with working previews and critique. Do not count a spacing adjustment, a new colour, or a written proposal as a separate design iteration. Keep changes in the local checkout. No commit, PR, deployment, or remote publication has been requested.

Address the user as Sir, in a restrained Jarvis-like tone. Keep progress updates short. Do not spawn subagents. Read current git status and applicable instructions before editing: other threads have substantial ongoing changes in this same checkout. Preserve unrelated work.

## What the user rejected

The original party overview and tabbed Combat kit exposed too little information to be useful during play. The user likes the dashboard idea but wants a **large character dropdown** that contains useful saving throws, proficiencies, and combat features. The full sheet should be needed for the remaining detail and editing, with a quick return to the party.

The objective is a useful DM reference during play, not a second full character sheet. Information must be readily visible after opening a character; avoid making the DM navigate several tabs or repeatedly expand small containers just to find basic modifiers.

## Current implementation

The first replacement is implemented, but has **only passed typecheck**. Its browser layout and interactions remain unverified. The original implementation's three completed review passes do not validate this new design.

Current source files:

- `src/components/party/PartyDashboard.vue`: party selection, overview, full-width character-details toggle, HP/inspiration actions, tracker actions, and sheet navigation/return.
- `src/components/party/PartyCombatKit.vue`: now renders the larger character reference despite its historical filename. It requests one quick sheet for the opened character, independently of the selected-sheet store.
- `src/components/party/party-dashboard.css`: existing theme tokens, responsive reference columns, save table, skill/proficiency lists, and dropdown styles.
- `src/composables/usePartyDashboard.ts`: snapshots, visibility-aware polling, save serialization, and conflict recovery. Preserve its guarantees.
- `shared/party-dashboard.ts`, `server/routes/rooms.ts`: saved-data snapshots and protected room actions. The redesign has not required backend changes.

The new panel currently contains:

- Initiative, proficiency bonus, speed, and hit dice remaining.
- All six ability scores, modifiers, and saving throws; proficient saves are marked and active-item save bonuses are included.
- Trained skills with modifiers and proficiency/expertise labels; a checkbox exposes all skills.
- Armour, weapon, tool, and language proficiencies.
- Initially expanded slot/resource trackers, searchable attacks, pinned-first combat features, and known/prepared spells where applicable.
- Direct links to Summary, Combat, Spells, Equipment, Features, and Proficiencies on the sheet.

The desktop layout uses reference information on the left and combat information on the right. Phone layout stacks these columns. One character expands at a time. Feature and spell rule text still uses existing disclosures. No separate combat-category tabs remain.

## Three design iterations on resumption

### 1. Broad character reference

Finish and assess the currently implemented large dropdown. Keep saves, skills, and training beside attacks, resources, and combat features. Establish whether it supplies enough immediately useful information without becoming excessively tall.

- Inspect real desktop, tablet, and phone screenshots and use the controls.
- Fix column proportions, section hierarchy, stat baselines, long names, button wrapping, and empty sections.
- Judge whether the full-width toggle clearly communicates what opens and whether the expanded character remains identifiable.
- Record what works, what feels sparse, and what makes the DM scroll too far. Save a representative screenshot for comparison when feasible.

### 2. Combat-first dropdown

Build a materially different arrangement using the same data and actions: put attacks, combat features, and usable resources first, with saving throws and trained skills as a compact reference alongside them. Keep proficiency/language details available in the same large panel, lower down if necessary.

- Compare information order and grouping rather than changing only appearance.
- Keep saves visible without an additional category switch.
- Compare a compact ability/save strip against the table from iteration 1; preserve full labels and clarity at narrow widths.
- Assess default-open resources with many trackers, dense feature lists, and caster spell lists. Avoid a wall of controls displacing the character's useful actions.
- Review the same representative characters, viewport sizes, and sheet-navigation tasks as iteration 1. Record the practical tradeoffs.

### 3. Refined final design

Use the stronger structure, or combine the successful parts of the first two. A possible outcome is a stable save/ability reference with compact training on one side and attacks/features/resources on the other; select it from evidence, not in advance.

- Tune the default visible information, rule disclosure, caster/noncaster differences, and responsive reading order.
- Resolve the density-versus-height tradeoff and remove duplicate controls or explanatory copy that do not help during play.
- Keep all essential reference information inside the dropdown and make the sheet links obvious for everything else.
- Compare the alternatives in a brief user-facing handoff. Do not add a permanent design selector or retain three competing production interfaces unless asked.

These are three build/review/refinement iterations, not three permission checkpoints. On resumption, proceed through normal implementation choices without repeatedly asking for confirmation, while incorporating any user feedback that arrives.

## Functional and design tasks across the iterations

### Information correctness

- Reuse the main sheet's calculations for saves, skills, expertise, proficiency bonus, equipment-aware AC, attack/damage totals, spells, slots, and resources. Check representative values against the main sheet, including active item bonuses and saved homebrew/multiclass rules.
- Keep ability modifiers and saving throws clearly distinguished. Mark proficiency/expertise in accessible text, not colour alone.
- Show recorded proficiencies and languages without inventing missing training. Do not add fabricated action rules or live conditions/concentration.
- Handle noncasters, characters without attacks/features, missing/custom spell definitions, companions, and very long recorded lists clearly. Innate spells and full/custom references currently rely on the main sheet; reconsider only within the existing data capabilities and state any remaining limitation.
- Expose enough feature information to identify an action quickly; expand full rule text on demand using existing renderers. Preserve pinned-first ordering and access to other saved features.

### Interaction and navigation

- Preserve explicit party selection, assigned-character defaults, unassigned/empty states, filters, and Shadow Champion inclusion semantics.
- Test opening/collapsing the dropdown and switching between characters. Ensure collapsing an earlier row does not leave the new trigger awkwardly offscreen.
- Verify direct sheet links land on their actual sections. One-action return must restore the expanded character, filter, scroll position, and originating control's focus.
- Check that pending saves visibly disable relevant navigation/actions instead of leaving apparently usable controls that silently do nothing.
- Verify quick HP damage/healing/temp HP, inspiration, slot use/recovery, and resource spending/recovery still work. Preserve temp-HP-first damage and correct Enter behaviour.
- Decide how much expansion state should survive switching characters. Preserve state on ordinary refreshes and sheet returns; avoid unnecessary persistence complexity.

### Layout, appearance, and accessibility

- Use the established semantic colours, display/body fonts, reading-size settings, appearance controls, and motion system. Do not redesign the whole site.
- Check approximately 1440, 834, 390, and 320 CSS pixels; include large text and the existing light/dark/parchment appearances.
- Exercise long names, many skills, long proficiencies, many resources, and long feature descriptions. Keep values aligned and text legible without horizontal page overflow.
- Avoid nested scrolling areas. Let the page scroll naturally, with deliberate placement of high-use information on phones.
- Verify keyboard operation, labelled inputs, visible focus, expanded-state announcements, touch targets, and readable training indicators.
- Keep motion tied to user actions. Respect reduced motion; polling must not replay entrances or reset open rules, searches, trackers, or focus.

### Requests and save safety

- Keep summary loading separate from the singleton selected-sheet store. Do not mount full sheets or resolve reference packs for every party member.
- Fetch detailed data only for the opened character. Inspect request counts when expanding, polling, saving, navigating, and returning.
- Preserve visibility-aware polling and cancellation. Test that stale reads cannot overwrite completed saves.
- Keep timestamp-based conflict protection. Verify a real conflict reloads current data, explains what happened, and requires a deliberate retry. Do not automatically replay uncertain writes.
- Preserve DM-only snapshots and existing membership, assignment, ownership, and revocation boundaries. Do not broaden access as part of the design work.

## Verification and handoff

1. Use T3 `preview_status` first, open a preview if needed, then inspect screenshots and actual interactions. Follow the current runtime's browser fallback rules. Do not assume a browser failure from an earlier session still applies.
2. Use synthetic local demo data for writes. Do not modify production characters to create examples or screenshots.
3. After the final design, run the build, relevant typechecks, and the focused party tests (`shared/party-dashboard.test.ts` and `server/routes/rooms-party.test.ts`). Add tests only for meaningful new logic or regressions. Broaden tests when the changes warrant it.
4. The original full-suite run had an unrelated Dagger expectation failure in `src/lib/character-builder.test.ts:71`. Reassess current results and distinguish pre-existing failures from regressions rather than assuming they remain identical.
5. Update `docs/PARTY_DASHBOARD.md` to describe the final behaviour and the validation actually performed. Its older Behaviour/review sections describe the original sparse design and must be reconciled.
6. Provide a working preview link and a concise comparison of the design iterations, what was chosen, what was verified, and any material limitations. Clearly distinguish local preview from live deployment.

## Local preview setup

- Frontend: `http://127.0.0.1:5173`.
- Demo room: `http://127.0.0.1:5173/rooms/6ad95a568325620893ad5072`.
- API: port `4012`, explicitly using local Mongo database `dnd_site` at `127.0.0.1:27017`.
- Synthetic demo account and three assigned characters (Fighter, Wizard, Rogue) were created for this preview. Credentials are in the conversation; do not duplicate them in tracked files.
- Ignored preview config: `.preview.local/party-link.config.ts`. It routes both API paths to port 4012.
- The tracked Vite API proxy and preview proxy use `changeOrigin: false`. String proxy targets rewrote Host and caused browser logins to fail the API origin check with “Please make changes from the website itself.” This was corrected and browser login verified. Preserve the fix and the API's protection.
- Dev processes may stop during the break. Check listeners and restart the relevant local processes if necessary; do not assume the old API on port 4000 includes the dashboard endpoint.
- Other implementation work is ongoing in the same root checkout. Do not clean the workspace or reset unrelated files to obtain a clean preview.

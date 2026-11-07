# Character, Compendium and player audit — 28–29 October 2026

Release follow-up: the creator scope and local repairs below are now published. See [the verified release and remaining limits](creator-option-release-2026-10-29.md). Earlier status statements are historical.

Follow-up: the feat/background identity gap, biography/notes save omission and reproduced late-name creator failure are corrected and verified **locally**. See [completion evidence and limits](creator-option-completion-2026-10-29.md). Special imported-item validation is now published and verified; see [the item release](imported-item-release-2026-10-29.md). The original observations below remain historical evidence; these repairs are not published.

The expanded audit found three confirmed functional gaps and one reproducible browser interaction anomaly. Production code and deployments were not changed. The test character, two imported test packs, assignment and player membership were removed through supported APIs after the checks.

The highest priority is the character editor's biography/notes save: it reports success while omitting those fields from its request.

## Scope and evidence

Live desktop Edge checks ran against `https://dndoldal.vercel.app`, using separate disposable DM and player accounts and the existing isolated test room. The player had no imported library. No real character, pack or campaign was edited. Shared preview automation timed out twice, so the live checks used the previously validated direct Edge fallback.

The user's saved website sessions returned 401. Exhaustive entry checks therefore used the integrity-verified **23 October snapshot of 126 packs**, replayed through the frozen production implementation in `.local/imported-room-release-v4-20261028/source/`. This is not a fresh exhaustive audit of the current private live library. Live browser coverage used a separate synthetic pack spanning all 15 categories. The standard SRD catalog was exercised through the live workflows, but was not exhaustively opened entry by entry in this run.

Private credentials, source files, full synthetic results and screenshots remain ignored under `.local/anomaly-audit-20261028/`. No private pack source is included in this report.

## Confirmed findings

1. **Biography and notes edits do not persist.** Reproduced with both a combined character edit and a notes-only edit. Save returned HTTP 200, but the subsequent character response still contained an empty note. The PATCH request did not contain `personality`. `CharacterEditTab.vue` edits `draft.personality` but omits it from the update payload. Identity, ability score, inventory, spell, resource and custom feature changes in the same test persisted. This affects more than notes: the editor renders all personality fields, including backstory, in the same section. Repair should retain the editor's existing concurrent-play merge behavior.

2. **Creator-selected feats and backgrounds can miss their sheet reference definitions.** The full creator saved source-qualified labels such as `Audit Scholar — isolated-complete-audit.orcbrew` and `Audit Moon Feat — isolated-complete-audit.orcbrew`. `sheetReferences()` compares those labels against the definitions' plain names; neither category has a selected ID fallback comparable to class/subclass/race. The assigned player's `backgrounds` and `feats` reference arrays were empty. Copied feat, background and ancestry feature text remained available; selected class, subclass, race and spell definitions arrived correctly. Repair should preserve identities and ambiguity handling rather than stripping labels and choosing an arbitrary same-name definition.

3. **Some imported items cannot pass the grant validator.** Of 6,603 imported equipment/magic-item definitions, 47 failed `importedEquipment()` → `itemSchema` validation: 43 fixed-damage blowgun variants with damage `1`, three special weapon definitions without ordinary damage dice/type, and one description exceeding 30,000 characters. Synthetic fixed-damage blowgun and net grants both reproduced HTTP 400 on the live item-grant endpoint. The browser allowed the fixed-damage item into an editor draft, so draft and grant paths are inconsistent; saving that particular draft was not tested. Repair must preserve fixed damage and special no-damage rules, and handle oversized rules explicitly without silently truncating them or inventing damage dice.

## Browser anomaly requiring isolation

In repeated full creator runs, entering the name after the other nine sections left the field empty. A normal click also timed out with `<div class="cb-workspace">…</div> intercepts pointer events`. The page retained focus, no open native dialog remained, and the input and its ancestors were neither disabled nor explicitly inert. Bringing the page to the front did not resolve it. Entering the name before the other choices allowed the complete character to save. Shorter fresh-page and item-only reproductions accepted the name normally, including duplicate weapons.

This is a reproducible anomaly in the automated Edge workflow, with screenshots and DOM observations in `late-name-results.json`; its application/browser cause is not established. It must not be described as a fixed issue or a clean pass. The suspected duplicate-item key is not proven to be its cause.

## Exhaustive imported-entry results

All **13,712 active deduplicated imported entries** in the snapshot were parsed, searched by their own name, reached across the complete 415-page pagination traversal, and rendered using the production Vue reader/statblock/item components. No rendering exceptions or unformatted object output were found. The individual name-search checks used each entry's browse record; the pagination traversal used the complete category index. This checks reachability, not every possible query/facet combination or correctness of every game rule.

| Category | Entries rendered and reachable |
| --- | ---: |
| Spells | 316 |
| Equipment | 1,165 |
| Magic items | 5,438 |
| Classes | 37 |
| Subclasses | 301 |
| Races | 103 |
| Subraces | 244 |
| Monsters | 5,622 |
| Backgrounds | 74 |
| Feats | 228 |
| Invocations | 73 |
| Boons | 4 |
| Selections | 71 |
| Languages | 36 |
| Other | 0 |

All 301 imported subclass definitions matched an available imported or SRD parent class using the production matcher. The snapshot's one personal item passed inventory validation; it contained no saved Compendium edits. One background and 18 languages contained only sparse source information; these were classified as source omissions rather than rendering failures. The live synthetic pack supplied the otherwise empty Other category.

## Live workflows and measurements

- Every synthetic entry opened in its category, including all 15 category readers and multiple item types. No JavaScript exceptions or unexpected API failures were recorded in this run.
- Creation traversed all ten sections and actually saved a level-2 imported character. It included race/subrace, class/subclass with a parent key different from its display name, an explicitly allowed feat, a language, an imported spell, weapon, armour, accessory, consumable, gear, and a duplicate weapon. Saved IDs and all six inventory rows were verified. The successful automated workflow took 15,185 ms to fill, browse and save; this is **not a page-load measurement**.
- All eight editor sections opened. Every fixture class, subclass, race, feat and spell appeared in the editor options. Descriptive definition selectors retained the expected IDs. Added equipment stayed in the draft until Save. The imported spell could be removed and selected again. Saved character data confirmed identity, ability, gear, spell, resource and feature changes. Notes failed as described above.
- Player Combat, Spells, Equipment, Features, Proficiencies and Bio & notes opened. Imported class, subclass, race, subrace and feat feature text and every inventory type remained visible. The missing note followed the owner-side save fault; it was not a separate room synchronization failure.
- An assigned player opened the selected character in **1,038 ms**, measured from room navigation to sheet navigation becoming visible. A new imported item reached the already-open player inventory in **2,534 ms**, measured from Give item to the second matching inventory label becoming visible. These are single observations using a tiny synthetic library, not the user's 126-pack loading times or an average/p95 claim.
- Player HP updates reached the owner. Reusing the old update timestamp returned 409. The player could not access the owner's editor options or private definition endpoint. Unrelated imported classes/subclasses were excluded from references.
- Unassignment returned 404 for both player quick-sheet and reference APIs, and the already-open player sheet disappeared. Expected post-revocation polling 404s were recorded separately from application failures.

The frozen production candidate's focused automated suite was rerun: **7 files / 50 tests passed**, Vitest duration 1.89 seconds. This did not rerun the previous release's entire 554-test suite.

## Availability limits and next work

The editor has definition selectors for class, subclass and race, imported feat/spell pickers, and the shared imported item composer. Subrace and background are editable text fields rather than definition pickers. Invocations, boons and generic selections remain readable Compendium content and can be recorded as manual features; this audit does not establish automatic choice/progression support for them. Those are existing product limits, not missing records from the local cache.

Fix biography/notes persistence first, then the feat/background identity-reference mismatch and special-item conversion/validation. Isolate the long creator interaction before declaring full creation reliable. No fix, commit, push or promotion is included in this audit. All active test characters and packs were verified empty after cleanup; the reusable test accounts/empty room and previous archived synthetic item remain available for further validation.

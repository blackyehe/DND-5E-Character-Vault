# Imported content availability — 28 October 2026

## Problem and scope

The preceding [room smoke check](room-content-smoke-2026-10-28.md) found that the room's Give item picker offered SRD equipment and personal Workshop items, but omitted imported Compendium items. Related inspection found gaps in imported subclass matching, descriptive class selection in the sheet editor, and references for secondary multiclass subclasses or changed display labels.

This release adds an Imported items section to the shared item composer and exposes that composer from character creation. It uses existing authenticated Compendium browsing, item validation, draft saving and inventory delivery. It does not change room assignment permissions, databases, billing, or infrastructure. Frozen production source is the baseline; unrelated dirty extension/editor work and previously unshipped polling changes are excluded.

## Behavior and safeguards

- Imported magic items and normal equipment can be searched, filtered and paginated. Opening a room or the ordinary item library does not fetch an imported catalogue. The picker attempts existing device-index browsing and otherwise uses bounded server metadata pages. A freshly authorized full definition is fetched only after selection; a deleted or inaccessible definition cannot become a new selection.
- Selected items enter the editable form for review. Full imported descriptions and available base weapon/armour data are retained. Simple bounded numeric enchantments are recognized; conditional effects and formula bonuses are not invented. Instance/grant/template identity is removed, quantity becomes one, and equipment/attunement starts inactive. Imported choices do not create a reusable template unless the user explicitly chooses to remember the item.
- The creator's new item flow adds to its local draft. The sheet editor's item flow adds to its unsaved draft. Room Give item uses the existing validated immediate grant and polling paths.
- Subclasses match their class's index, content key, aliases or name, accommodating pack keys different from display names. Creator and level-up use the same matcher.
- Sheet references include selected class/race/subclass IDs and aliases, plus secondary multiclass subclass names. Room readers still receive only definitions relevant to their assigned character from the DM's library.
- Descriptive imported classes, races and subclasses appear in editor definition selectors without creating or publishing Workshop automation. Existing published Workshop metadata remains present for compatibility with older open tabs.
- A missing explicitly linked class produces a visible warning while preserving saved character details. A different same-name definition cannot silently replace it. Explicit imported magic-item sources are likewise preserved during sheet equipment enrichment instead of being guessed from an SRD item name or numeric suffix.
- Sheet-reference cache keys gain a projection version. Old disk references are rejected so they cannot retain an incomplete class/subclass projection. This intentionally causes one reference refresh after the release; saved quick-sheet details remain usable. Room/player references remain ineligible for owner disk persistence.

## Payload calculations

Measured against the frozen live baseline, using gzip on built JavaScript:

| Bundle | Additional gzip bytes |
| --- | ---: |
| Main entry | 104 |
| Character creator | 128 |
| Item composer | 393 |
| New lazy imported picker | 2,546 |
| Existing browse helper, when not already loaded | 839 |

The picker and shared browse helper together total 3,385 gzip bytes on first use when neither is cached. These are built artifact measurements, not browser transfer timing guarantees. No eager full imported catalogue download is added.

## Validation

Both frontend and server typechecks and the production build pass. The final full test suite passes **554 tests**, with **55 existing skips**. The frozen candidate's focused suite passes **50 tests**. The reviewed deployment's source tree is compared against every expected runtime path and SHA-1: **385 files**, including two new runtime files. Only the explicit release allowlist is overlaid on the previous frozen production manifest.

Hosted desktop Edge checks use separate synthetic DM/player sessions and an isolated room. The player has no personal imported packs. They cover selected DM class/subclass/race/feat/spell references, rendered class/subclass features, imported weapon delivery with complete rules, unauthorized catalogue/editor access, descriptive editor selectors, creator subclass matching, and adding a simple imported magic item to the creator draft. No real campaign or character is changed.

Final reviewed-build measurements: imported search 1,061 ms; selected full definition 158 ms; grant response 387 ms; already-open player equipment visible 3,784 ms, including polling. The delivered inventory retained its imported magic-item ID, longsword base, +2 enchantment, damage dice and complete description. These are single observations using a tiny synthetic library, not measurements of the user's 126-pack library. Earlier reviewed builds observed 2,747–3,195 ms delivery visibility and 473–566 ms detail fetches. Timing variation is material; this is an availability fix, not a claim of a multi-second performance gain.

The saved-category scenario currently exercises the authorized server fallback. Local-only reuse is **not verified** by this check and is not counted as a performance success. Existing server fallback keeps imported content available; the existing local revision validation and timeout policy are unchanged.

## Limits and release evidence

Imported descriptive class data does not automatically encode every progression, resource, special feature or choice. This release preserves descriptions and identities and does not invent missing automation. Users still review sparse imported item base data before saving. Imported inventory copies are not automatically personal Workshop templates.

Private generated account credentials and disposable validation helpers remain in ignored `.local/` evidence, outside source control. Final evidence is under `.local/imported-room-release-v4-20261028/`; earlier reviewed candidates remain separate and do not receive the public alias.

## Reviewed release

The final deployment is `dpl_DVqiVg3We3VnmxG5foXorSm9cUhr` (`dndoldal-jsp97cyfh-dndenjoyerstudio.vercel.app`). All 16 hosted checks pass, covering the main character/room workflows and additional draft, multiclass, changed-label, level-up and deleted-source cases. Both browser contexts report no JavaScript errors.

The public alias was independently confirmed on this deployment after promotion. The previous production deployment, `dpl_9pVoeYF37sCpbVocZWBZJNyL7ZaZ`, remains the rollback reference. The initial immediate alias read still showed the previous deployment; an independent read confirmed propagation. The promotion request was not repeated.

All ten main browser checks were repeated successfully against `https://dndoldal.vercel.app`. This public run observed 2,214 ms search, 657 ms full detail, 1,329 ms grant response and 2,160 ms until the already-open player showed the imported item. Source ID, weapon data, full description, authorization boundaries, creator subclass selection and draft item addition all passed. There were no browser JavaScript errors.

Cleanup through the public APIs removed the synthetic pack, character, assignment and player membership. Active test characters, imported packs and personal item templates were verified empty. Empty reusable test accounts/room and the previously archived synthetic template from the original smoke check remain isolated from real users. No private credentials, original import sources or diagnostic helpers are committed.

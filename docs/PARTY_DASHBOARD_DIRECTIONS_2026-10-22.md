# Party dashboard: four new directions

Follow-up: the user selected direction 2 with retained live vitals and HP editing.
Implemented, reviewed and published; see [focused dashboard release](PARTY_FOCUS_RELEASE_2026-10-22.md).
The original preview exploration is documented below.

Scope: local interactive design previews following the user's rejection of the
current information density and navigation. Do not publish or replace the live
dashboard until a direction is selected. Primary requirements: saving throws,
skill proficiencies and expertise, plus armour/weapons/tools/languages.

## Shared design plan

Retain the existing obsidian/crimson appearance: canvas #08090b, paper #141518,
soft surface #202125, line #3b3c43, ink #f1edef, muted #c1b9be and accent #be3449.
Use the site's Barlow body and Barlow Condensed headings, with local font files
embedded in the standalone preview. Left-align identity, headings and training;
align numeric saves in stable columns. Keep proficiency and expertise labelled
in text, not just colour. Preserve the six-save order across every view.

Combat rules and resources are optional disclosures. HP/AC appear only as
secondary context. Open sheet uses the previously accepted collapsible character
chooser at left, adjacent full-width content and an explicit Back to party
action. The sheet is a demonstrator, not a live editor; use labelled synthetic
characters, computed scores, no backend requests, and no production writes.

## Directions and review against the brief

1. **Party ledger**: compare all six saves across the party; trained skills stay
   in each row, while one inline training panel reveals equipment, tools and
   languages. Best for party-wide save calls. On phones each row becomes a
   labelled six-save reference instead of a horizontally scrolling table.
   `Name | Str Dex Con Int Wis Cha | Trained skills | Training / sheet`
2. **One character**: a quiet character list on the left; the selected member's
   saves, all trained skills and training groups fill the main workspace.
   Best for fewer competing panels and quick repeated character switches.
   `Character chooser | Six saves / skills + training / optional combat`
3. **Check finder**: choose the saving throw or skill the scene needs, then see
   the whole party ranked by the actual modifier, with training labelled.
   The selected member's complete saves and training stay directly below.
   Best for “who can handle this?” rather than reading every character.
   `Check selector | Ranked party results / selected character reference`
4. **Foldout roster**: slim rows retain all saves and trained-skill names;
   exactly one expanded row shows the full skills/training reference.
   Best for the familiar character-dropdown model without a wall of combat.
   `Character + save strip / trained skills / one expanded training reference`

These differ in navigation and what remains visible, not just spacing or colour.
Avoid new card-based stat grids, secondary category tabs for basic information,
automatic entrances, and nested scroll panels. Review long names, empty party,
empty search, mobile controls, focus return from the sheet, keyboard use and
reduced motion. Keep the current production implementation untouched.

## Delivered preview and refinements

[Editable preview source](../design/party-dashboard/preview.html),
[portable HTML](../design/party-dashboard/index.html), and
[setup/review instructions](../design/party-dashboard/README.md).

Local comparison: http://127.0.0.1:5190/. The four buttons switch design;
`#ledger`, `#focus`, `#finder` and `#foldout` open specific directions.

The recommended starting point is One character: complete saves and training
without simultaneously exposing every character's rules. Ledger is strongest
for party-wide comparison. Check finder suits scene-specific lookups, while
Foldout retains the familiar dropdown approach but can become longer.

Visual review changed the ledger to start with training collapsed, preventing
the first open panel from interrupting group comparison. The phone version of
One character uses a compact native chooser so a multi-row roster does not push
saves down the page. Returning from the demonstration sheet restores the exact
sheet opener, including a combat link inside an open disclosure. No new motion
or nested scrolling was introduced.

## Verification

All four layouts checked at 1440, 1024, 834, 728, 390 and 320 CSS pixels. Tests
include long names and large text, all six saves, proficiency and expertise,
an active-item save bonus, Bard half proficiency for untrained checks, combined
character filtering, empty search/party recovery, every navigation approach,
combat disclosure, adjacent-sheet section switching, chooser collapse/expand,
return focus and preserved reference state. Check finder changes its ranking
for saves and skills. One character exposes all 18 skills on request and supports
the native phone chooser. Keyboard character selection and reduced motion pass.
No horizontal overflow, offscreen controls, browser runtime errors, external
requests or data mutations were observed.

The product-native browser was tried first: navigation/evaluation were available,
but snapshots failed twice with `Preview automation snapshot timed out after
15000ms.` Interaction checks and screenshots used the established local
Playwright/Edge fallback. T3 `html_preview` separately checked the portable HTML
before inline delivery. Evidence: `.preview.local/party-directions/results.json`
and screenshots in that directory.

These are interaction prototypes, not a second implementation of the rules
engine. Examples calculate basic modifiers from fixed scores and training;
future production integration must retain the existing character/item rules
and account for conditional effects. The real Party component, API, single-sheet
store, polling and saves remain untouched. No deployment was performed.

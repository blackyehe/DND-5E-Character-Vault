# Website design review and preview

**20 October 2026 — proposal for review, not a production release.**

## Brief

Codex of Heroes is a working D&D table companion. Its primary job is to help the DM and players find rules and change play resources quickly. The user prefers a nearly black/crimson appearance, readable descriptions, compact centred layouts, independent content columns, a top character selector for the DM and collapsed management controls. Existing themes and character ownership rules must remain available.

This pass produces an interactive design prototype with sample data. It does not alter application routes, real characters, backend behaviour, authentication or deployment. Functional additions depicted in the monster reader remain proposals, not implemented data conversion.

## Pass one: visual plan

### Core palette

| Token | Colour | Role |
| --- | --- | --- |
| Night | `#090A0D` | Page canvas |
| Binding | `#17191F` | Raised controls and limited grouped surfaces |
| Edge | `#373943` | Meaningful separation and control boundaries |
| Page | `#F2EEF0` | Primary text |
| Annotation | `#BBB6BF` | Secondary labels and explanations |
| Crimson | `#BA4057` | Main action, active navigation and selected content |

A lighter crimson is derived for readable links; crimson fill uses light text. Backgrounds stay largely neutral so red does not wash over every disclosure and panel. A cool daylight comparison checks that hierarchy survives a different theme. Existing appearance options are not proposed for removal.

### Typography

- **Alegreya:** character and creature names, section headings, optional long rules text. Its book-like shapes fit a reference used during play, without copying an ornamental medieval title treatment.
- **Source Sans 3:** navigation, controls, stat labels and dense lists. Numbers use tabular figures where they change or align.
- Default interface text: 15px. Rules text: 16px with more breathing room. Text can be enlarged independently of layout density.
- Most prose stays below 70 characters per line. Compact controls do not require shrinking descriptions.

Fonts in the prototype are requested from Google Fonts, with local serif/sans fallbacks. A later application implementation should decide whether to self-host the licensed font assets and account for loading/fallback metrics.

### Layout

One centred workspace, a compact global header and content-specific hierarchy. App navigation and appearance stay in the header. The room uses a top character selector; it has no persistent DM identity sidebar.

```text
Codex of Heroes    Characters  Game rooms  Compendium  Workshop    Appearance

Revalon                        Player preview   Give item
Character selector             Players & assignments (collapsed)

Summary  Combat  Spells  Equipment  Features
Character name and essential statistics
Selected content, with independent reading columns
```

The compendium uses a searchable narrow index and a proper statblock reading area. The Workshop uses short form sections with a live item preview, rather than a promotional intro and a wall of equally prominent controls.

## Review before building

The first sketch risked becoming a generic red-on-black dashboard with identical bordered cards. Revised decisions:

- Keep the requested colour direction, but use red sparingly. Text, alignment and whitespace carry most hierarchy.
- Make character and monster names the main visual signature. Do not add a marketing hero, decorative gradients, fantasy scenery or large metric tiles.
- Use compact rows for resources and inventory. Reserve contained surfaces for actual controls, selections and live previews.
- Use sentence case labels and plain action names. Remove uppercase eyebrows, repeated technical subtitles and decorative numbering.
- Preserve the user's existing navigation decisions. A dramatic persistent left roster would undo the agreed DM layout.
- Keep controls and prose at useful sizes. Compactness comes from less repeated chrome and fewer oversized gaps.

## Prototype contents

### Game room and sheets

- Top character selector, collapsed assignments and visible DM/player-preview distinction.
- Summary opens first, with identity, abilities, AC, proficiency and HP in a compact layout.
- Combat separates class features from feats in independent columns.
- Resource controls share one compact section. HP and tracker interactions are local examples.
- Spells retain the agreed vertical order: cantrips then 1st level in the first column; 2nd level and higher continue in the next column. Description panels stay readable.
- Equipment separates weapons, armour, accessories and treasure, with attack/AC details and expandable rules.
- Give item is an obvious dialog with a local recipient/result; no real delivery is performed.

### Monster compendium

- Searchable entries and basic type/CR filtering.
- Readable ability scores, explicit saves, skills, defences and actions.
- Related numbers are grouped as a statblock, not raw reference JSON.
- Sample entries are deliberately fictional preview creatures so this is not presented as converted production content or an official rules source.
- No rolling, encounter creation, automatic saves or token integration is claimed.

### Item Workshop

- Identity and classification first, then base weapon/armour type, rarity/value, attunement and supported effects.
- The preview changes with the selected category and properties.
- Name and category changes update the preview; a local draft action gives explicit feedback.
- Charges remain outside this pass, matching the earlier decision to discuss their trackers separately.
- The item preview distinguishes supported flat AC/save modifiers from descriptive effects. Arbitrary prose does not become executable rules.

### Character library

- A compact roster with readable identity and one clear Open sheet action.
- Search and class/source context; destructive actions are not repeated as equally prominent buttons on every character.
- Existing create/import features remain part of any eventual implementation; this prototype does not implement those backend flows.

## What changes visually versus what requires functional work

| Change | Scope after design approval |
| --- | --- |
| Fonts, calmer surfaces, consistent button/input hierarchy | Shared presentation; preserve appearance tokens and options |
| Denser roster and room header | Presentation plus existing navigation bindings |
| Spell/equipment reading layouts | Shared sheet components; preserve existing calculations and permissions |
| Clearer item creation flow | Existing item composer/Workshop bindings; preserve validation and update propagation |
| Monster statblock | New shared normalised fields, import mapping and renderer; source review required |
| Save/connection labels | Bind only to actual request state; do not imply push or successful saves prematurely |

The completed progressive sheet loading is a baseline to preserve. This design does not reopen it as an unfinished optimisation project. No new network dependency or full-library load should be added to sheet opening.

## Interaction and accessibility notes

Use native controls, visible keyboard focus, sentence case and clearly labelled input fields. Meaning must not depend on crimson alone. Reflow the compendium and Workshop into one column on small screens. Rules remain available by click/tap, not hover alone. Dialogs need explicit Close actions, Escape dismissal and focus return. Motion is limited to user-requested changes and respects reduced-motion settings.

Preview interactions use in-memory sample state. Reloading can reset examples. They do not use website login, APIs, cookies, real assignments or cloud saves. Fictional demo users are not current room members.

## Suggested application order after review

1. Approve the shared visual language and compactness.
2. Apply the shared header/type/control changes to one local screen for comparison.
3. Extend to shared sheets and equipment without changing rules.
4. Apply the clearer Workshop structure.
5. Build the monster data/reader feature as a separate functional task.
6. Review the concrete application result before any production deployment.

The first design preview is kept outside the production bundle. No live push, commit or backend change is part of this design pass.

## Review notes

- Compared the proposal against the current application navigation, room controls, appearance tokens and sheet styles, plus a read-only live room view.
- Reviewed responsive rules for narrow screens and adjusted the layout to stack form fields and statblock sections.
- Corrected the prototype so base weapon/armour changes update the item preview, explicit weapon bonuses follow the sample character's Strength, exhausted resources disable their Use control, and leaving Player preview restores the previous sample state.
- Kept cold library/reference work out of the proposed initial-sheet layout. The completed loading improvements remain the application baseline.
- The preview script passed a syntax check. No application test suite was run.
- A screenshot review of the new preview could not be completed: the available browser could not reach the local preview server. The existing website was inspected, but that is not proof of the proposal's rendered layout. The interactive conversation preview is supplied for design review; browser layout/keyboard checks remain necessary before application implementation and deployment.

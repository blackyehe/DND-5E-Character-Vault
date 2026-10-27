# Four alternative website directions

**20 October 2026. Design exploration only.** All versions use the same illustrative Fade sheet, HP/resources, equipment and content. No live application or database changes.

## Shared constraints

Keep the DM character selector at the top, management collapsed, readable descriptions, accessible keyboard controls, separate feat/class columns and the agreed vertical spell-level ordering. Summary remains the initial character tab. Differences concern layout and visual identity, not a new rules engine. Each proposal also includes a matching compendium and item-making treatment.

## Adventurer's folio

**Intent:** A D&D Beyond-inspired digital character sheet, interpreted for Codex rather than copying its assets or brand.

- Palette: page `#F5F5F2`, sheet `#FFFFFF`, ink `#25262B`, secondary `#62636D`, red `#A62D36`, dark chrome `#202127`.
- Type: **Barlow Condensed** for identity and major stats; **Barlow** for the interface and rules.
- Layout: dark global header, white sheet, a framed horizontal ability row, clear stat tiles and a main section beside compact resource controls. Left-aligned reading, centred individual stat values.
- Character: a recognisable character-sheet silhouette with clear boundaries for actual numerical controls.

```text
Dark app navigation
Room / character selector / collapsed management
Name and class                       HP / AC / proficiency
Six framed ability values
Character tabs
Selected sheet content               Resources
```

**Pre-build critique:** A literal copy risks unnecessary ornament and crowded borders. Use a single red sheet edge and purposeful stat framing; omit branded logos, decorative shields and backdrop artwork. Referenced the public [D&D Beyond customisation guide](https://www.dndbeyond.com/posts/1003-how-to-customize-your-character-sheet-on-d-d) and its linked example imagery.

## Blacksteel

**Intent:** A restrained black-and-wine console for quick session use.

- Palette: black `#08090C`, steel `#181B22`, edge `#3D414D`, text `#F0EDF2`, secondary `#B9B5C2`, wine `#A53450`.
- Type: **Chakra Petch** for numbers and identity; **Source Sans 3** for controls and prose.
- Layout: compact single-line identity, an integrated ability strip and a broad working area with a narrow resource column. Low-height controls and strong alignment carry the hierarchy.
- Character: precise and quiet, with wine confined to selected navigation and main actions.

```text
Compact navigation and room controls
Identity / essentials on one line
Thin ability strip
Character tabs
Actions, rules and equipment          HP and resources
```

**Pre-build critique:** Avoid making a fantasy site look like a stock trading terminal. No terminal text, monospace labels, arbitrary charts or neon glows. Use the distinctive type only for short identity/stat content; keep descriptions human-readable.

## Moonlit atlas

**Intent:** A softer midnight-blue reference space with a lilac accent and a clear page index.

- Palette: midnight `#131A2A`, raised blue `#202C42`, edge `#45536C`, text `#F0F1F8`, secondary `#B8C4D9`, lilac `#BFA4EE`.
- Type: **Fraunces** for identity and titles; **Nunito Sans** for interface and rules.
- Layout: a book-title identity row, a narrow local section index, and a spacious selected page. Resources form a compact horizontal shelf below the main content rather than a permanent identity sidebar.
- Character: a navigable reference volume, with generous reading rhythm and restrained curved corners.

```text
App navigation / top room selector
Character identity and essential values
Section index | Current page
Resource shelf across the page
```

**Pre-build critique:** Blue/lilac must not turn into a generic gradient dashboard. Use flat surfaces, no starfield or illustrations, and no decorative resource cards. The local index contains navigation only; it does not reintroduce the distracting DM summary sidebar. On narrow screens the index becomes horizontal.

## Field notes

**Intent:** A clean, ink-blue character record inspired by practical table notes rather than aged parchment.

- Palette: cool paper `#ECEFF2`, sheet `#FCFCFD`, ink `#26333F`, secondary `#586B7C`, blue `#355B7C`, rule `#CCD5DD`.
- Type: **Literata** for character names and rules; **IBM Plex Sans** for labels and controls.
- Layout: quiet navigation, left-aligned identity and numerical facts in a ruled record. Independent rules/equipment columns, followed by compact resource rows. Stat values are inline instead of framed tiles.
- Character: the least visually noisy option, with a clear distinction between reading and changing values.

```text
Quiet navigation / room selector
Character name and class
Abilities as a compact record
Character tabs
Rules and equipment                  HP and defences
Resource rows
```

**Pre-build critique:** Avoid cream/terracotta stationery and decorative journal trappings. Cool neutral paper and actual data rows provide structure; no faux handwriting, coffee stains, decorative page numbers or dense newspaper columns.

## Comparison and interaction

The preview carousel changes the complete style/layout. Every style starts with the same character and Summary section. Each offers Combat, Spells, Equipment and Features, plus matching Compendium and Workshop pages. HP, resource spending, equipment/attunement and item-preview edits are isolated sample interactions. They do not save to the website.

An optional text-scale control supports comparison without confusing compactness with smaller fonts. The existing previous redesign remains a separate fifth reference, not replaced by these four explorations.

No style is selected or approved by this document. Final production work should follow the chosen direction and preserve the existing theme system, permissions, rules and progressive loading. No automated application tests or live deployment are part of this exploration.

## Character-sheet refinement from user feedback

The user shortlisted Adventurer’s folio and Blacksteel. These remain two alternatives, not a decision to combine or deploy them. The next preview covers character sheets only.

### Revised layout plan

Keep the palettes and type families above. Retain the compact identity and section navigation. Summary, Spells, Equipment and Features keep a narrow right column for HP, slots and points. Combat uses the current website's structure across the available width:

```text
Character identity / compact ability scores / character tabs

Combat:
Vitals and damage/healing       Death saves, inspiration, hit dice
Attacks across the full width
Slots and resource trackers in one wrapping shelf
Spells in independent vertical level columns
Class combat features           Feats

Other tabs:
Selected tab content            HP / slots / points
```

### Review before building

The previous combat proposal treated Combat like another reference tab with a persistent resource sidebar. That removed the current site's useful central arrangement of vitals, attacks, trackers and spells. The refinement restores those sections and removes the duplicate combat sidebar. Compactness comes from shorter control groups, shared rows and less repeated framing, not missing information or tiny rule text.

Damage must consume temporary HP before current HP in the sample interaction. Short/long rest buttons recover eligible slots/trackers only; the current site's HP/hit-dice controls remain separate. Feats and class features retain independent expansion. The Combat spell preview follows the same vertical level order as the dedicated Spells tab. Equipment and attunement must affect the displayed sample AC consistently across tabs.

The new preview opens on Combat specifically to review this feedback; it does not propose changing the production DM default of Summary. All values are illustrative and remain local to the preview. No character data, site code, deployment, authentication or loading behaviour is changed.

## Selected direction after the compactness correction

The user supplied a screenshot of the **Folio sheet** and clarified that this is the desired compact direction, including its layout and typography. A spacing-only update of the original sheet did not meet that intent.

Local sheet implementation now follows the Folio frame, with the earlier full-width Combat refinement retained. Layout, typography, palette and density are separate preferences. The corresponding implementation decisions and review limits are recorded in [Character sheet compactness](CHARACTER_SHEET_COMPACTNESS.md). The live site has not been changed by this local work.

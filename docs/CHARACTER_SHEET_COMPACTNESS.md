# Character sheet compactness pass

## Corrected direction — 20 October 2026

The user clarified with a screenshot of the **Folio sheet** from the frontend-design preview. Reducing padding in the old layout was an incomplete interpretation. The desired change includes the header, horizontal ability strip, typography, independent content columns and resource rail.

### Revised plan, reviewed before implementation

- Palette option matching the reference: page `#f2f2ef`, sheet `#ffffff`, field `#f8f8f6`, border `#cbccd0`, ink `#29292e`, red `#a62d36`. Existing dark and other palettes remain selectable independently.
- Type: Barlow Condensed for identity, headings and large values; Barlow for controls and rules. A separate typography preference retains the existing Georgia/system option.
- Layout: horizontal identity and six ability values above the tabs. Reference tabs place their main content beside a narrow HP/resource rail. Combat keeps vitals, attacks, a horizontal resource shelf, spells and features across the available width, as previously requested. Editing has the full content width.
- Alignment: left-aligned headings, names and rules; centred ability values; remaining-use totals aligned against their labels.
- Content: all existing features and item/spell details remain available. Class features and feats occupy separate columns where space permits. Reference cards avoid a second nested card around every tracker.

```text
Name / level / class / race
STR   DEX   CON   INT   WIS   CHA
Character tabs

Reference tabs: selected content       HP / resources
Combat:        existing sections across full width
Edit:          full-width form
```

Review: the supplied image is the visual reference; a new visual direction is unnecessary. Layout, typography, palette and spacing must be separate settings. The right resource rail must reuse current save handlers and calculated values, with no extra data requests. The original presentation remains available as Classic. No deployment is authorized by this correction.

The earlier implementation record below documents the spacing-only pass and is superseded by this clarification wherever it conflicts with the revised plan.

### Folio implementation and review

- `CharacterSheetFrame` provides the shared header, navigation and optional resource rail. It is used by the real character sheet and the local comparison renderer.
- `CharacterHeader` shows the current character's identity and six ability values. Summary retains XP, passive perception, speed and the proficiency lists without repeating the header.
- `HitPointsPanel` is shared by Combat and the resource rail. It preserves temporary-HP absorption, bounded healing, direct HP edits and the existing character-store update path. Quick −1/+1 controls are available in the rail; larger adjustments expand below them.
- `CombatTrackers` supports a rail presentation using the same calculated slot/resource pools, full rules references and saving handlers. Combat retains its wrapping tracker shelf and has no duplicate rail.
- Folio feature groups share a panel with independent reading columns. Class combat features and feats are side by side. Spells retain vertical level order. Smaller screens use a collapsible HP/resource strip above the content.
- Appearance now separates layout, typography, density and palette. The Folio paper palette and a one-click **Use Folio preview style** preset reproduce the reference. Existing saved colours remain valid. Classic layout and typography remain available independently.
- Barlow and Barlow Condensed are served from local project assets with their OFL licences. Font loading uses `swap`; there is no runtime font-service request.

The revised read-only comparison uses the real shared frame/components, the same Ashton snapshot and an optional Obsidian palette. Native disclosures and tab navigation work locally. Resource writes, searching and full reference dialogs are not simulated. The comparison omits room-management chrome and fresh reference hydration; it does not claim to be a live sheet.

Type checking and the frontend production build pass. No automated test suite or live save exercise was run. This remains a local implementation for visual review; no deployment or push has occurred.

## Decision and scope — 20 October 2026

The user approved applying the compactness improvements to the current character sheet, across features, spells, resources and equipment. A faithful comparison with a long existing character must be reviewed before anything is published.

This pass preserves the current sheet structure and appearance. The Folio and Blacksteel proposals remain separate design explorations.

## Design plan

- Base palette: canvas `#08090b`, paper `#141518`, field `#0d0e11`, soft surface `#202125`, text `#f1edef`, crimson accent `#be3449`. Existing theme mixing and contrast calculations continue to supply actual colours.
- Type: existing Georgia headings and Segoe UI/system body text. Rules retain their existing scaled 14px text and 1.75 line height.
- Layout: left-aligned disclosure names with secondary metadata alongside when space allows; actions in a separate adjacent area. Content and actions wrap rather than overlap. Independent columns retain their current ordering.
- Principle: recover space from repeated padding and stacked metadata rather than reducing the legibility of rules.

Review against the brief: a new palette, replacement navigation or ornamental character dashboard would exceed the approved scope. These are excluded. The current Combat layout remains intact.

## Local implementation

### Appearance foundation

`sheetDensity` is independent of theme, accent and reading size. Compact is the new default; Comfortable is available under Appearance → Character sheet spacing. Preferences remain on the current device.

Existing saved appearance objects are still accepted. An older preference object without a density retains its colour and text settings and receives the compact default. Invalid density values are ignored. No account or character data migration is needed.

### Shared disclosure rows

Features, Combat features and Spells now use `SheetDisclosure.vue`. Native disclosure behaviour remains keyboard accessible. Pinning, pin ordering and spell preparation still call their existing handlers. Full names wrap; no rule text is truncated.

The action area is in normal layout flow instead of occupying an absolute rectangle over a Combat heading. Expanded descriptions use the existing `FeatureText` and feat references. Existing independent columns remain separate stacks.

### Sheet-wide spacing

`sheet-density.css` supplies shared panel, section, row and summary spacing tokens. Compact rules cover resource cards, spell groups, equipment profiles, Combat controls, summary and proficiency rows. Existing biography and editor panels inherit the common panel and section spacing; editing fields retain their existing form spacing.

Death save controls share a row with their labels in compact mode. Equipment statistics put their labels alongside values where space allows. Touch controls retain larger targets, even when this reduces the space saving on a phone.

## Comparison

The comparison uses the actual Vue tab components and generated stylesheet from before and after the changes, with the same saved Ashton Hollowborne character snapshot from 18 October: **39 features, 12 known spells and 7 inventory entries**. Its complete feature descriptions are retained, including the long imported proficiency entry. Two homebrew spell definitions were read from the current signed-in sheet; the remaining spell definitions come from the bundled SRD library.

The comparison is read-only. Native disclosures open; resource, equipment and editing mutations are disabled. Search inputs are disabled because this is a static rendering, not a running copy of the application. It intentionally omits room management chrome, live refreshes, and additional reference hydration. At wide viewport sizes it reproduces the sheet's independent column grouping; at narrower sizes it uses the existing single-column breakpoint.

The local generation harness and character snapshot remain ignored rather than becoming application source. No live character was changed.

## Checks and review boundary

- Frontend type check passed.
- Production frontend build passed.
- Before and after snapshots generated successfully from the same character data.
- No test suite was run.
- No deployment, push or public rollout was performed.

The intended next step is the user's visual review. Closed headings provide the largest reduction. Expanded rules retain their reading space; a universal reduction to one quarter of the current height is not promised.

# First Folio refinements — 20 October 2026

## Requested changes and design plan

After the initial production release, the user requested fewer scrolling and clearer summary and Combat priorities.

- Retain the chosen Folio palette and typography. Reference base colours remain canvas `#f2f2ef`, paper `#ffffff`, field `#f8f8f6`, ink `#29292e`, secondary `#62636d`, accent `#a62d36`; theme variables supply dark alternatives.
- Summary: group AC, maximum HP, speed, initiative, proficiency bonus and passive perception in one compact row. Show trained skills and their modifiers in a dedicated, always-visible section directly below. Use spell-style disclosure rows for armour, weapons, tools and languages; put experience controls below the skill section.
- Combat: make Vitals span the available width. Put inspiration and hit dice there so they remain accessible while the character is healthy. Render death saves immediately below only at zero current HP.
- Feature lists: use stable columns of up to six entries, up to three columns per band according to actual available width. Class combat features precede feats. Make whole sections collapsible without removing individual features.
- Apply section collapsing to spell levels and inventory categories as well, while keeping existing spell-level reading order and item controls.

```text
Summary:  AC | Max HP | Speed | Initiative | Proficiency | Passive perception
          Trained skills and modifiers, always visible
          Training disclosures              Experience

Combat:   Full-width vitals, HP, inspiration and hit dice
          Death saves only at 0 HP
          Existing attacks / resources / spells
          Class combat features: [1–6] [7–12] [13–18]
          Feats below
```

Review before implementation: collapsing trained skills would conflict with the user's stated priority, so that section remains directly visible. Pure CSS newspaper columns can rebalance when a rule expands; explicit six-entry stacks preserve each column's order. Smaller containers use fewer columns, without clipping names or rules. Whole-group disclosure state is stored on the current device per character and section; it is not a permanent character choice.

This refinement changes presentation and retains the existing calculations and save paths. Death-save visibility does not itself reset saved results. No database migration is needed. The initial Folio release `46ccd37` and deployment `dpl_6xEEVqQmcqw3dXLACrAoyyEUWiP7` remain the application rollback baseline for this pass.

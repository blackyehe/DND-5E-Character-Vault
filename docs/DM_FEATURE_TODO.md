# DM feature to-do list

Created: 22 October 2026.

This is the saved list referred to as **the list**, **the DM to-do list**, or
**the feature to-do list** in conversations about future website features.
Read and update this file when the user refers to that list. An unchecked item
is a suggestion, not authorisation to start implementation. Check an item only
after its implementation and relevant verification are complete.

Scope: website suggestions from the feature discussion, excluding work already
planned for the [Owlbear plugin](OWLBEAR_EXTENSION_TECHNICAL_PLAN.md). The party
dashboard is retained as the separately authorised website task; its inclusion
does not expand the plugin scope. The order below is a suggested starting point.

## Active website work

- [x] **Personal Dashboard character folders — published.** Preserve the
  chooser and sheet while adding nested campaign folders, drag and batch moves,
  and equivalent keyboard controls. Explorer-tree and breadcrumb-shelf designs
  were implemented and browser reviewed. The accepted tree revision starts as
  a full-width folder browser until a character is opened, with Back to folders
  restoring the browser. Published with explicit authorisation on 22 October 2026.
  See [release verification and rollback](CHARACTER_FOLDERS_RELEASE_2026-10-22.md).

- [x] **Party dashboard — published.** Provide a
  compact overview of the selected party with aligned panels and useful vitals,
  quick access to sheets and their sections, an easy return to the overview,
  and combat features available on demand. Keep it accessible, responsive,
  restrained in motion, and free of unnecessary panels. Three implementation
  and refinement passes are authorised. Track progress in
  [the party dashboard thread](t3-thread://v1/mcp:1a15d5e5-a187-462f-8f80-3116c9fce144).
  **Refined design and corrected full-sheet layout accepted on 22 October 2026.** The rejected
  sparse design has been replaced by a larger character dropdown. Broad-reference,
  combat-first, and refined previews were built and reviewed; the refined version
  passed browser interaction/responsive checks, the build, and 14 focused tests.
  The full sheet uses the space beside the collapsible character chooser;
  desktop/tablet/phone geometry, section switching, and dashboard return were verified.
  See [preview links and verification](PARTY_DASHBOARD_PREVIEW_REVIEW.md).
  Published with explicit authorisation on 22 October 2026 at
  https://dndoldal.vercel.app. Production Maps navigation was preserved.
  See [release verification and rollback](PARTY_DASHBOARD_RELEASE_2026-10-22.md).

## Suggestions to explore

- [ ] **Session preparation and running page.** Assemble a written recap,
  likely scenes, NPCs, clues, and rewards into tonight's plan. Link existing
  notebook entries, mark developments during play, and carry unresolved
  threads into the next session. Build on the notebook; automated encounter
  histories and combat summaries are outside this item.

- [ ] **Structured NPC, location, faction, and quest entries.** Extend notebook
  entries with useful fields, relationships, and filters: NPC motivations and
  affiliations, locations, quest objectives, status, rewards, and related clues.
  Preserve selective sharing and distinguish DM secrets from player knowledge.

- [ ] **Shared loot and party treasury.** Add a shared unclaimed stash, item
  requests or claims with optional DM approval, and currency splitting. Reuse
  existing inventory and item delivery rather than creating another item
  system. Embedded item-delivery controls remain in the Owlbear plan.

- [ ] **A "since last session" view.** Bring together the latest written recap,
  newly shared clues, and changed quest objectives when players return. Show
  only information each player is allowed to read. This is campaign catch-up,
  not the general play-state history planned for the plugin.

- [ ] **Custom campaign progress clocks.** Track rituals, pursuits, faction
  plans, crafting, and approaching threats, with optional player visibility.
  These track narrative progress rather than combat rounds or timed effects.

- [ ] **Reusable random tables.** Save custom tables of names, rumours,
  encounters, treasure, and complications. Draw a result and optionally save
  it into a campaign note. This does not include sheet dice buttons or Dice+
  integration.

## Maintenance

Keep plugin-planned features in the Owlbear plan rather than duplicating them
here. Recheck that plan before adding suggestions that overlap with embedded
sheets, play controls, encounters, effects, casting, dice, or change history.
Update active-work status from verified progress; launching a thread does not
mean its implementation is complete.

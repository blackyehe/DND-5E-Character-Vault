# Character workflow improvements

Requested 9 November 2026. Work proceeds in small, tested stages; the user's
priority is consistent changes from every authoring screen to affected characters.

## First stage: compatible changes and dependable saves

Implemented increment: Workshop **character options** and Compendium now share
character review/apply controls, including effective spell attack/DC totals.
Workshop option saves explain unavailable actions, update their local pack hash
immediately and avoid a second library reload. Complete prepared option categories
replace unrelated source reads when available; saving reads only the target pack.
Conflicts keep the draft and require a fresh comparison. Tests cover all 30 offered
Benefits, explicit native-feat refresh/removal and preserved play state.
Released to the website as `dpl_CBitkm3auCwY8ZziXSoiYG2X65WF`; see
`docs/audits/character-option-review-2026-11-09.md` for validation and limits.

This does **not** yet unify personal Compendium editions with native Workshop pack
edits across all authoring screens. That reconciliation, creator types beyond
character options, and character-side pending-update indicators remain open.
The existing explicit Compendium review remains available for those definitions.

Resume point, explicitly deferred at the user's request: reconcile personal
Compendium editions with native Workshop edits across all creator types, then
add character-side pending-update indicators. The lighter sheet changes below
do not change authoring, synchronization, or player write permissions.

- Give Workshop and Compendium saves the same affected-character preview and
  explicit apply controls. Show actual spell attack/DC changes clearly.
- Preserve HP, spent uses, inventory state, character choices and approved rules
  until the owner applies a reviewed change. Reject stale reviews and saves.
- Verify the Zhaerin Contractor feat's +1 spell attack and +1 save DC case.
- Show why a save is unavailable. Keep drafts on failed saves and conflicts.
- Release saving controls as soon as the save succeeds; avoid waiting for an
  unrelated full-library rebuild. Measure/target expensive pack reads.
- Audit supported Benefits through character calculations and source display.

## Remaining requested stages

The two implemented sheet tasks below are live on the website in
`dpl_3pKTvMLAEZ5Ps555nQmB8tx6QvJM`; validation and limits are recorded in
`docs/audits/sheet-usability-2026-11-09.md`. Other stages remain pending.
The website Summary follow-up is live in `dpl_827hsYMEGD9Jx4HaS1BZsXaXZTiN`,
with the same audit file recording its validation and Owlbear-specific limits.

1. Uniform spell-slot/resource panels with aligned counts and controls. Give
   spell attack and spell save DC a prominent, readable position. Per-spell
   attack modifiers beside damaging spells are a later addition.
   Implemented: aligned cards/recovery labels and a separate spell-stat strip,
   including the compact layout. Folio's narrow rail retains its list layout.
2. Remove inventory items directly from the Equipment screen, with appropriate
   DM/player permissions and protection against removing the wrong filtered row.
   Implemented for owners/DMs beside each item's controls. Inline confirmation
   removes the whole stack; character version and exact saved row are checked.
   Failed saves retain the item and confirmation. Player write permissions stay
   as before; players can change quantities/equipment but cannot delete entries.
3. Give item creation, giving and Workshop editing the full supported Benefits
   controls already available in Compendium editing.
   Implemented: the same Benefits editor is now in normal/magic item creation,
   Workshop editing and the create-and-give form. It validates grants before
   saving and preserves explicit removal. Compendium keeps its separate Benefits
   step, avoiding duplicate editors. Personal-edition reconciliation remains at
   the deferred resume point; this control addition does not solve that layer.
   Released on the website as `dpl_GHue5E3BbMEiMr2Lwwh824ikXHGh`.
4. Add spell creation to the Homebrew Workshop, reusing the existing spell builder.
5. Add source-linked trackers to items, feats and other grants. Activation,
   removal/unequipping, recovery and preserved spent uses must follow the source.
6. Add a clear long-rest action to website and Owlbear summary screens.
   Website implemented: a top-of-summary action shares resource/slot recovery
   with Combat. HP and hit dice remain manual, as before. Owlbear is still pending:
   it has a separate frontend and scoped write grants/API, so it needs its own
   rest action and permission tests rather than a website-only button change.
7. Add saving throws to summaries below skills/proficiencies, plus readable attack
   dice/damage modifiers and spell attack/DC totals near the combat information.
   Website implemented: six effective saves with proficiency, equipped/custom
   attacks and spell totals above Training. Owlbear summary placement remains
   pending in its separate frontend; the backend already projects these values.
8. Improve individual spell presentation (item 6 in the remaining-work list).
   Use the supplied [spell reference](references/character-ui-2026-11-09/spell-presentation.png)
   for a compact, expandable spell row: name/source, casting ability, applicable
   save DC/modifiers and an easily visible attack-roll expression where relevant.
   Show each spell's casting time, range, duration and components with **bold
   labels**, plus level/school and other relevant casting details. Keep the full
   description and scaling text readable when expanded. Spell attack modifiers
   must use the correct casting source and current active bonuses; save-only
   spells should show their applicable save information.
9. Re-imagine repeated character-sheet UI elements consistently across the website
   and Owlbear. The supplied [sheet example](references/character-ui-2026-11-09/sheet-section-dividers.png)
   shows too many red outlines and divider lines in skills, saving throws and the
   combat summary. This is an example of a broader visual issue, not a request
   limited to those three panels. Explore contrasting background surfaces, subtle
   overlays, spacing and typography to distinguish sections with fewer borders.
   Apply a coherent treatment across comparable panels, rows and statistics in
   the different sheets, preserving readability across themes and screen sizes.
   The final visual treatment is still to be designed; no UI change is requested
   in this reminder-only update.
   10 November: three [comparison previews](design/character-sheet-directions-2026-11-10.html)
   were rejected: soft sections, open spacing, and grouped bands. Revised
   [background comparisons D/E/F](design/character-sheet-backgrounds-2026-11-10.html)
   give every entry a background and distinguish proficiency/expertise by actual
   rank. Await the user's choice before changing the live styles. The [design notes](design/character-sheet-directions-2026-11-10.md)
   preserve the scope and shared approach; authoring synchronization is still
   deferred at the earlier resume point.

A stage is complete only after its implementation and relevant checks. A release
must preserve the current deployed baseline; the working checkout also contains
unpublished work. Production character updates use the same explicit review flow.

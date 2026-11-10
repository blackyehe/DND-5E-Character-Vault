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

10 November: the website synchronization foundation reconciles personal
Compendium editions with native Workshop items, character options, spells,
classes, subclasses and races. Both editors use stable identities and shared
edition revisions. Source/edition saves are transactional; stale drafts and
reviews require reopening. Existing characters retain approved rules until
explicit review/apply. Item copies capture source values so later reviews can
preserve custom values, quantities, equipment state and personal notes. New
acquisitions capture current editions. Character-side pending notices show
changed or unavailable approved definitions. Assigned players can read notices;
owners/DMs apply reviews. The existing review UI is reused.

See the [synchronization audit](audits/definition-consistency-2026-11-10.md) for
release evidence and boundaries. The Volenta/+1 regression is verified with an
isolated fixture; the final live record comparison/application remains an owner
review through the new controls. Deployment does not rewrite campaign records.
Next stage: source-linked trackers (item 5 below), using this shared identity and
review behaviour. Owlbear UI and broader pack-saving performance remain separate.
Released on both website aliases as `dpl_BBrEU5XjSSpSNeBkfKu91mziGXWx`.

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
   Implemented: a Spells section reuses the Compendium editor's Spell, Casting,
   Targets & effects, Benefits and Review steps. Device drafts, pack publishing,
   later editing, review/apply, backup and Recently deleted are connected. Native
   spell edits retain previous source aliases and relink known/prepared/active
   references only when reviewed; spent slots and unrelated play state stay saved.
   The wider Workshop/Compendium personal-edition reconciliation remains deferred.
   Released on the website as `dpl_2uySpBC89mtPVjThordZcZn2wy2Y`; see the
   [spell-creator audit](audits/spell-creator-2026-11-10.md).
5. Add source-linked trackers to items, feats and other grants. Activation,
   removal/unequipping, recovery and preserved spent uses must follow the source.
   Item stage implemented: normal/magic item creation and Compendium item editing
   offer linked trackers with stable IDs, fixed maxima, rest/manual recovery and
   carried/equipped/attuned availability. Acquisition creates each inventory
   entry's pools immediately. Removal hides the pools; actual item/definition
   deletion removes their counters. Temporary deactivation retains spent uses.
   Reviewed item/tracker renames, additions and removals update existing copies
   without resetting uses. Newly given copies retain their current source edition
   when older copies on the character are still waiting for review.
   Character-option extension implemented: Workshop and Compendium offer a Linked
   trackers step for feats, backgrounds, subraces, invocations, boons, choice groups,
   languages and references. Pools derive from approved, owned grants, support an
   unlock level and keep their UUID/counter through reviewed renames and changes.
   Removing a grant or tracker removes its pool; temporary level ineligibility
   hides it without losing uses. Player spending and rest recovery use the source
   counter. Classes/races retain their existing Workshop resource rules. Explicit
   feat tracker lists replace automatic guesses; manual trackers are not converted
   by name. Other imported-item formats and independent Owlbear rollout remain
   later work; item quantities share one pool per inventory entry.
   See the [option tracker audit](audits/option-trackers-2026-11-10.md) for release
   validation and boundaries.
   Option trackers released to both website aliases as
   `dpl_Eb3yGcTZHVcyR9HTABHwFhpcjXkz`.
   Released to the website as `dpl_7eDtt8S2qHaqymXAqiEjzUEfFLPU`; see the
   [linked-item tracker audit](audits/item-trackers-2026-11-10.md).
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
   10 November: the website now uses one shared spell-detail block with bold
   Casting time, Range, Duration and Components labels. It is used in ordinary
   and innate spellbooks, the party combat view, Compendium, character creation
   and level-up previews. Ritual/concentration markers remain visible.
   The selected B presentation is implemented in the website spellbook: shaded
   compact rows show recorded casting source/ability and applicable attack/save
   values using current active bonuses. Granted spells use their own ability;
   unknown imported mechanics point to the rules. Prepare controls and expanded
   details remain available. See the [spell-row audit](audits/spell-rows-2026-11-10.md).
   Owlbear and equivalent per-spell rows in other combat surfaces remain pending.
9. Re-imagine repeated character-sheet UI elements consistently across the website
   and Owlbear. The supplied [sheet example](references/character-ui-2026-11-09/sheet-section-dividers.png)
   shows too many red outlines and divider lines in skills, saving throws and the
   combat summary. This is an example of a broader visual issue, not a request
   limited to those three panels. Explore contrasting background surfaces, subtle
   overlays, spacing and typography to distinguish sections with fewer borders.
   Apply a coherent treatment across comparable panels, rows and statistics in
   the different sheets, preserving readability across themes and screen sizes.
   The original addition was a reminder; the preview selection below now guides
   the first implementation.
   10 November: three [comparison previews](design/character-sheet-directions-2026-11-10.html)
   were rejected: soft sections, open spacing, and grouped bands. Revised
   [background comparisons D/E/F](design/character-sheet-backgrounds-2026-11-10.html)
   give every entry a background and distinguish proficiency/expertise by actual
   rank. The user selected **F**, using the current theme colours and brighter,
   semibold ability names and spell-stat labels. The website Summary is the first
   implementation, released as `dpl_Gy5h9g4AUUSuYm3ZJ8t9XWcjd1dW` (see the
   [release audit](audits/summary-f-theme-2026-11-10.md)); equivalent elements elsewhere and in Owlbear still need the
   wider consistency pass. The [design notes](design/character-sheet-directions-2026-11-10.md)
   preserve the scope and shared approach; authoring synchronization is still
   deferred at the earlier resume point.

A stage is complete only after its implementation and relevant checks. A release
must preserve the current deployed baseline; the working checkout also contains
unpublished work. Production character updates use the same explicit review flow.

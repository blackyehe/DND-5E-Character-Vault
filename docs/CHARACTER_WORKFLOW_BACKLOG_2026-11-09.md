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

1. Uniform spell-slot/resource panels with aligned counts and controls. Give
   spell attack and spell save DC a prominent, readable position. Per-spell
   attack modifiers beside damaging spells are a later addition.
2. Remove inventory items directly from the Equipment screen, with appropriate
   DM/player permissions and protection against removing the wrong filtered row.
3. Give item creation, giving and Workshop editing the full supported Benefits
   controls already available in Compendium editing.
4. Add spell creation to the Homebrew Workshop, reusing the existing spell builder.
5. Add source-linked trackers to items, feats and other grants. Activation,
   removal/unequipping, recovery and preserved spent uses must follow the source.
6. Add a clear long-rest action to website and Owlbear summary screens.
7. Add saving throws to summaries below skills/proficiencies, plus readable attack
   dice/damage modifiers and spell attack/DC totals near the combat information.

A stage is complete only after its implementation and relevant checks. A release
must preserve the current deployed baseline; the working checkout also contains
unpublished work. Production character updates use the same explicit review flow.

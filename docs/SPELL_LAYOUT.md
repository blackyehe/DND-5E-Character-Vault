# Spell display order

19 October 2026: the DM requested spell groups ordered down a column before
continuing in the next column, instead of alternating levels across rows.

The shared spellbook in Combat and Spells therefore fills two independent
columns with consecutive level groups. With Cantrips and spell levels 1–3,
the left column contains Cantrips then Level 1, and the right contains Level 2
then Level 3. Longer lists split into consecutive halves. Narrow screens show
one ascending sequence. Expanding a description does not stretch the other
column. Feature columns retain their existing layout.

Character creation's selected spells use the same grouping and column order.
Spells are alphabetical within each level. Unresolved levels appear last;
innate racial grants retain their separate section and are sorted by actual
spell level when available, rather than the character level at which gained.

The shared character sheet supplies the same layout to owners, room DMs,
assigned players, temporary Player view, and champion reference previews.
Views showing only spell counts or slot totals remain summaries, rather than
gaining a new spell catalogue. No character choices, prepared state or resource
counts are changed by sorting.

Main files: src/lib/spell-level-groups.ts,
src/composables/useIndependentColumns.ts,
src/components/sheet/SpellbookPanel.vue,
src/views/CharacterCreationView.vue.

Frontend build and server typecheck passed. No automated tests were added or
run for this presentation change.

The Obsidian integration discussed alongside this request remains a proposal.
No vault access, note upload, integration code or handout sharing was enabled.

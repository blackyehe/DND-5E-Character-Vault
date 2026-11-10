# Narrow resource rail spacing

The user reports the C-surface rail is visually unappealing: cards touch, labels
sit flush against the sides, counts/controls feel disconnected, and the narrow
three-column spell-stat strip is cramped. This is a geometry regression exposed
by the shared surface update, not a request for new colours or mechanics.

Confirmed cause: sheet-folio.css sets the rail's tracker grid to display:block and
its cards to padding:14px 0 with transparent backgrounds and divider borders. The
new shared C rule replaces the background/border/radius, while retaining those
old list dimensions. Grid gap therefore has no effect and there is no side inset.

Two quick previews retain C colours (Obsidian/Crimson), left-aligned readable labels
and existing controls. Spell attack and save DC use two columns, with the casting
ability above, to avoid cramped three-column labels. Counts are top-aligned.

- A: retain individual cards, adding proper padding and explicit vertical gaps.
- B: group slot levels in a compact panel; feature resources keep padded cards.

Implementation must target rail geometry explicitly, preserve standard grids,
long names/notes, manual/unlimited/hidden resources, short/long recovery metadata
and current permissions/actions. If B is chosen, mixed slot recovery cannot be
flattened to a single long-rest label. Empty note placeholders must not create
dead space. The mock uses screenshot values and local-only controls, no API saves.

The user selected B on 11 November. Implement it in the website rail; the normal
wide tracker grid keeps individual slot cards. Shared recovery text is used only
when every visible slot pool has the same rule; mixed pools label each row.
Check classic/folio, compact/comfortable,
narrow/wide and longer labels using real stylesheet specificity. The website
must be reconstructed from the newest level-up/C/parity hosted boundary; never
deploy the checkout wholesale. The previews themselves do not save character data.

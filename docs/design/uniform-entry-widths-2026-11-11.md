# Consistent disclosure widths — 11 November 2026

The supplied spell/inventory screenshots show the surface shrinking according to
its sibling controls: At will versus Prepared, attunement versus no attunement,
and currency versus equipment. Granted spells also span the whole page while
other spells use columns. The user wants bounded, uniform, neatly aligned panels
across equivalent elements, using the existing C colours and theme typography.

Root causes: SpellbookEntry/SheetDisclosure are flex rows with content-sized action
siblings; inventory does the same with its entire controls fieldset. The spellbook
places innate grants outside its ordinary column layout. A literal fixed width
on every viewport would overflow mobile/expanded-roster layouts, so previews use
consistent per-list columns or a bounded card width with fluid small-screen sizing.

- A retains external actions, reserving an equal gutter per collection. Desktop
  inventory controls have fixed slots even when attunement is absent. Existing
  rows remain familiar; mobile controls wrap below. Widths align within each list.
- B bounds complete cards at 330px in the illustrative preview, wrapping cards
  as available width changes. Actions are in a lower inset area, leaving every
  header the full card width. The same grid applies to granted/ordinary spells,
  inventory/treasure and shared feature disclosures. Long rules expand vertically.

Existing C palette: paper #1a161a, field #130f13, soft #36242a, accent #be3449,
ink #f1edef; entry/body colours derive from the existing token formulas. Reuse
the user's actual palette/font preferences in implementation. No new aesthetic
or component dependency is needed. Native disclosure behaviour and external
action semantics must remain valid: no buttons nested in summary.

Neither preview was selected. The user explicitly rejected changing the layout
or disclosure behaviour: opening one column must not move the other. These HTML
comparisons are historical proposals, not an implementation contract.

Approved clarification: width/alignment only. Preserve all component markup,
existing controls beside the panels, current group order, independent column
stacks and native opening behaviour. Reserve a consistent action gutter for
spell rows and shared feature disclosures. Inventory uses a consistent controls
area across equipment, attunement and treasure; narrow screens retain the existing
wrapped layout. Granted spells remain stacked above the class spell groups,
with a group width matching a class-spell column when two columns are visible.
Keep the C colours and theme typography; no universal narrow card or new footer.

Check actual available sheet width as well as viewport, compact/comfortable,
Folio/classic, long full rules, no-action rows, attunement, permission-hidden
removal and currency. Measure independent positions before/after opening each
column. Do not change numeric/stat/resource panels or the independently hosted
Owlbear markup for this website-specific correction. Release from the current
568-input tracker-editor boundary; never the whole checkout. Synthetic examples
and checks perform no character writes.

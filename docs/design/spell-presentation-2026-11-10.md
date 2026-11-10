# Spell presentation previews

Scope: website spellbook rows with casting source, recorded casting ability,
current applicable attack expression/save DC, and expandable rules. Retain bold
casting labels, level/school, descriptions and higher-level rules. Independent
Owlbear work remains a later rollout. The user selected B; the HTML retains the
three comparison proposals, and the implementation follows that selection.

Design plan: retain theme colours and the selected F-style shaded surfaces;
left-aligned labels, tabular modifiers, bright semibold spell names. Application
palette reference: Canvas #12191d, Paper #1c262c, Soft #243138, Ink #e8eee9,
Muted #b1c2bf, Accent #b2d69f. The inline comparison inherits the host's semantic
theme variables rather than forcing those colours. Implementation should retain
the sheet's Barlow / Barlow Condensed typography. No repeated red rules, shadows,
decorative animation, new UI settings or dependencies.

- A: aligned name / source / ability / attack-or-save columns, collapsing on phones.
- B: compact expandable rows, source and ability under the name, result at right.
- C: larger shaded spell cards, with casting time/range visible before expansion.

All three use the same illustrative spell data. Their differences concern density
and alignment; they preserve the user's expandable spell-reference structure.
Attack expressions are informational; dice rolling/resource spending are separate.
Do not infer multiclass attribution from a spell's published class lists. Ordinary
spellbook entries currently share the sheet's chosen ability; racial and structured
benefit grants carry their own ability/source. Distinguish definition provenance
(e.g. SRD) from the character's casting grant. Hide irrelevant attack/save numbers
for utility spells, and preserve unavailable references without invented results.

The HTML is self-contained, has no API calls or persistence, and remains a small
retained design reference. Desktop B/A and phone C previews produced no console
errors. The interactive tabs allow comparing all directions and opening rules.

The user selected **B**. The website implementation uses a shared spell entry
for ordinary and granted spells, theme-derived shaded surfaces and inline
attack/save readouts. Prepare stays outside the expandable summary. Structured
spell attack/save fields determine which numbers appear; unstructured imported
spells point to their rules instead of guessing from prose. Granted spells retain
their recorded ability, source, usage limits and higher-level text. Class
attribution remains limited to what the character actually records.

# Local SRD 2014 definitions

Spell, equipment, and magic-item data are an unchanged snapshot from:
https://github.com/5e-bits/5e-srd-api/tree/85acb251dad0b044a72c554c2d7f2d0c11e43504/packages/5e-database/src/2014/en

The upstream database software notice is preserved in UPSTREAM-LICENSE.md.
The game rules are from the System Reference Document 5.1, by Wizards of the Coast
LLC, available at https://www.dndbeyond.com/srd and licensed under Creative Commons
Attribution 4.0 International: https://creativecommons.org/licenses/by/4.0/ .

This snapshot supplies standard spell/equipment/magic-item lookups and character-scoped
references. It does not replace imported homebrew definitions or
add its full data to the frontend JavaScript bundle.

`srd-2014-compendium-index.json` contains only names, references, and filter metadata
for monsters, classes, races, subraces, subclasses, backgrounds, feats, and languages
from the same pinned revision above. Rebuild with `scripts/update-compendium-index.ts`
using the server's tsx runner. Spells derive their filter index from the existing local
spell snapshot. Each Compendium category requests only its own small index; full
descriptions still load when an entry is selected. No private content is in this index.

## Monster enrichment snapshot

`5etools-monster-references.json` is a separate, source-qualified reference
snapshot of the built-in 5etools bestiary, captured from https://5e.tools using
its public data loader, version 2.38.0, on 2026-10-22 (Europe/Budapest).
The upstream loader resolved monster copies, generated versions, legendary
groups, and lore/image inheritance before conversion. It contains 4,942 source
definitions, including reprints and forms, not 4,942 unique creatures.

The local converter is `scripts/build-monster-references.ts`; the matching and
safe supplement behavior are in `shared/monster-reference-match.ts` and
`shared/monster-enrichment.ts`. Original account packs and their IDs stay intact.
The snapshot is server-only. Artwork remains at its upstream URL and loads when
the Artwork view is selected; artist metadata is retained where supplied.
Each matched entry links to its precise upstream creature/source. Unavailable
sources and ambiguous forms are reported and are never replaced by another
edition. This dataset is distinct from the CC-licensed SRD snapshot above;
individual source books and artwork retain their own attribution and rights.

# Source-qualified monster enrichment release

Published 22 October 2026 at https://dndoldal.vercel.app.

## Result

Every one of the current 1,014 source entries was reviewed against the resolved
5etools 2.38.0 built-in bestiary (4,942 source/form definitions). All monster
copies, generated versions, legendary groups and fluff inheritance were
resolved by the upstream loader before local conversion. The snapshot was
captured at 2026-10-21 UTC / 2026-10-22 Europe/Budapest.

| Scope | Entries | Matched | Rules + Info | Shared Info only | Lore | Artwork | Unmatched |
|---|---:|---:|---:|---:|---:|---:|---:|
| Standard | 334 | 334 | 316 | 18 | 270 | 256 | 0 |
| Current account imports | 680 | 644 | 538 | 106 | 626 | 548 | 36 |
| Combined | 1,014 | 978 | 854 | 124 | 896 | 804 | 36 |

These count source entries, not unique monster families. A match does not imply
the source supplies lore and art for every creature. Reviewed alternate forms
share lore/art only; their combat rules remain distinct. Missing sources and
ambiguous forms are unchanged, with individual reasons in
[the complete review](audits/monster-enrichment-review-2026-10-22.json).
Unmatched cases include older UA sources, named Ravnica NPC/reskins, and
unspecified Bone Naga, Faerie Dragon, Guard Drake and Lizard King/Queen forms.
No newer edition was silently substituted.

Exact same-source matches supplement missing rule sections and entries; longer
source prose replaces shorter same-name reader prose. Original raw imports are
retained independently. Existing numeric statistics are not overwritten. Local
rules without matching source entries and existing local lore remain intact.
Lair/regional introductions, list items, endings, mythic encounters, nested
tables and source-qualified spell lists are included. Referenced spells remain
plain source-qualified text; this does not install their definitions.

## Interface

Statblock, Info and Artwork controls appear directly beneath the monster name.
Unavailable Info/Artwork controls are visibly disabled with an explanation.
Regional effects has a heading-level shortcut whenever present. Artwork loads
only when opened and retains titles/artist credits where the source supplies
them. Each enriched reader links to the exact upstream creature/source.
Print includes statblock and lore even if a different view was selected.

Aboleth now includes its matched MM 2014 traits, actions, legendary rules,
lair actions, full regional effects, lore and artwork. It keeps the existing
edition and statistics. Its 2025 counterpart is not substituted for the 2014
entry.

## Storage and recovery

The 644 imported supplements are persisted in one owner-scoped
`monster-enrichment` record keyed by the unchanged imported entry IDs. Original
Orcbrew pack bytes, content hashes, entry IDs and stored definitions were not
modified. Standard references receive the matching snapshot supplement from
the backend. Complete account backups include the enrichment record; original
pack-only exports intentionally remain the original sources.

Before applying the update, a complete backup of six characters and four
content records was saved to the ignored local file
`backups/pre-monster-enrichment-2026-10-22.json` (4,276,837 bytes).
The apply request checked the current 680-entry library revision and snapshot
before saving. A post-apply comparison confirmed all 680 original entry IDs
and every raw detail object were unchanged.

## Verification

- 40 targeted tests passed across conversion, all 4,942 references, source
  matching, ambiguity/UA/edition exclusions, local-rule preservation,
  idempotence, source-qualified spell lists, nested tables, Aboleth legendary
  groups, lore/art and existing Orcbrew/identity persistence.
- Frontend build and server typecheck passed locally and in Vercel.
- Local browser verification confirmed the heading controls, full Aboleth
  sections, lore visibility, lazy artwork loading (1,000px image), source link
  and no horizontal overflow.
- Production GET review matched the local counts; applying enrichment returned
  HTTP 200. The live imported reader returned 644 supplements, 626 lore entries
  and 548 artwork entries. Standard Aboleth returned its lair/regional sections,
  lore and artwork. `/api/health` returned `{"ok":true}`.
- Live Aboleth UI verification confirmed all four heading controls, visible
  lore, a successfully loaded 1,000px artwork image, working Regional effects
  navigation, no horizontal overflow and no displayed alerts. Temporary local
  UI/capture scripts and the local Vite process were cleaned up.
- No T3 Code restart, monster deletion, pack replacement or Git commit.

## Deployment and rollback

- Ready deployment: `dpl_5yW8v64habUazyJTdVWzpRe1Sp7u`.
- URL: https://dndoldal-68iioi73f-dndenjoyerstudio.vercel.app
- Production domain inspection confirmed this deployment is Ready and aliased.
- Previous Ready deployment: `dpl_FqHVKXTSW5CSvgmMmVDq2qRA8rhd`, at
  https://dndoldal-d3yrux13g-dndenjoyerstudio.vercel.app.

```powershell
vercel rollback dpl_FqHVKXTSW5CSvgmMmVDq2qRA8rhd --scope dndenjoyerstudio --yes
```

The previous application ignores supplemental records and shows the original
imports. Application rollback does not delete the supplement or rewind account
data. The original packs are already intact. Rollback has not been executed.

## Limits

36 imports have no safe exact source/form match and are explicitly unchanged.
Native authored creatures are never auto-enriched. Future source changes do
not automatically apply: they require a fresh snapshot and review. This release
does not introduce every 5etools creature into the browse catalog, replace the
SRD provider, or create editable native drafts for legacy Orcbrew imports.

# Book of Shadows bestiary import

**Superseded:** the source-book arrangement in
[MONSTER_SOURCE_PACKS_2026-10-22.md](MONSTER_SOURCE_PACKS_2026-10-22.md)
is now live. All 4,942 added monsters moved unchanged to 111 source packs.
Book of Shadows was restored byte for byte to its original 15 non-monster
entries. The account's separate all-content pack remains unchanged. The text
below records the earlier import and its implementation history.

The existing account pack `Blacky's Book of Shadows2.orcbrew` was updated in place
on 22 October 2026. Its ID remains `6ad3f02d30d81a047bd314ca`.

The input is the resolved 5etools 2.38.0 snapshot captured at
2026-10-21T23:20:06.955Z: 4,574 base creatures and 368 generated versions,
4,942 source/name records in total. Optional external homebrew/prerelease
repositories are outside this snapshot.

## Contents and preservation

- Added 4,942 source-qualified monster entries, with deterministic keys.
- Retained the original 15 non-monster entries and their parsed identities.
- Included 3,675 entries with lore and 3,634 with artwork references.
- Included regional effects in 237 entries, lair actions in 177 and mythic
  actions in 17. These counts reflect source-version records, not unique families.
- Retained every complete resolved monster/legendary-group/fluff record in
  `:codex/extended` provenance. All 4,942 provenance records, source ability
  scores and numeric average HP were checked against the captured source.
- Five upstream template entries lack ordinary combat stats; 246 entries lack
  CR. Missing source values remain unspecified.
- The separate `all-content.orcbrew` account pack and existing SRD routes remain
  available. Browsing groups creature names and exposes source/version choices.
  Existing MM definitions are preferred when present; otherwise XMM, then another
  available imported non-UA version. Definitions are not merged across editions.

The portable file is 47,452,540 UTF-8 bytes, with SHA-256
`4b6e5186ef1d20901d64e570c173ef90a4a606fd4c83b22f26690b46d02c9f3d`.
The authenticated website export was downloaded and produced exactly that byte
count and digest. Parser report: 4,957 total entries, zero duplicates,
zero non-finite values, zero warnings.

Files are in ignored `output/book-of-shadows/`: the expanded file, `original.orcbrew`,
`manifest.json` and `validation.json`. Original source SHA-256 is
`de8002722f5ae50362d649167c6e89bfa25f95a8fc9e7ec39d42ce8ee42a1b49`.
The pre-existing full backup also remains in
`backups/pre-monster-enrichment-2026-10-22.json`.

## Application support

Large packs use gzip/base64 storage with a 64 MiB decoded bound and a 9 MiB
encoded bound. The actual stored source is 8,973,612 ASCII bytes. Exports are
ordinary uncompressed EDN; storage compression is transparent to readers,
workshop edits, recovery, hashes and backup restore. In-place replacement is
owner-scoped and checks the reviewed hash plus the document revision.

The Compendium loads a compact index and fetches full imported definitions when
selected. Search covers all entries; the initial list shows 100 creatures with
a Show more control. The live combined imported index contains 5,622 entries,
5,077,678 decoded bytes and approximately 726 KB transferred with Brotli.
Together with the 334 legacy standard entries the UI shows 5,956 source entries
in 3,833 creature groups.

First uncached reads initially measured 16–19 seconds. A subsequent parser
optimization reduced local full-file inspection from approximately 2.5 seconds
to 1 second. After that change, observed new-instance detail/index requests
took approximately 5.8/7.3 seconds; warm detail requests measured 83–202 ms.
These observations are not latency guarantees.

## Validation and limits

61 targeted tests passed; one optional external-fixture test was skipped.
Frontend build and backend typecheck passed. Live API checks covered Aeromancer,
both Aboleths, both Duergar Soulblades and both Vampires, including distinct
edition statistics. The MM Aboleth reader exposes Info, Artwork, lair actions
and regional effects. The downloaded expanded file is independently usable.

Artwork URLs are retained rather than embedding image binaries. This import
does not implement every 5etools interaction, install referenced spell/rule
datasets, or turn all imported definitions into native editable Workshop drafts.
Source records remain inspectable where a dedicated UI control is unavailable.
No T3 Code restart was performed.

Final application deployment: `dpl_9QcDBoY9x6SULdYN1HVscmsagTgZ`,
https://dndoldal-pc2kvvm7j-dndenjoyerstudio.vercel.app, aliased to
https://dndoldal.vercel.app.
The immediately preceding compression-compatible deployment is
`dpl_Fy58wUzsQ9Ck6T3ph2WzgKnCgEXA`.
Do not roll the application back before compressed-pack support while this pack
uses compressed storage. Restore the original pack source first if an older
application deployment is required. No rollback was performed.

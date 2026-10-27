# Monster packs by source publication

The requested replacement for the Book of Shadows arrangement is one Orcbrew
file per exact upstream source ID. The existing resolved 5etools 2.38.0 snapshot
is reused; no second scrape or conversion is necessary.

## Portable artifacts

`scripts/split-monster-source-packs.ts` splits the reviewed expanded source using
EDN character spans. Every entry key and value is copied verbatim, including
resolved statblocks, lore, artwork URLs and source provenance. It checks the
content index and canonical definition of every resulting entry against the
original: 4,942 entries, assigned once each to 111 nonempty source packs.
Each file reparses without duplicates, nonfinite values or warnings.

Files are under ignored `output/monster-source-packs/`. The manifest records
source titles, counts, byte lengths, SHA-256 digests, normalized source hashes
and all monster indexes. `Monster source packs.zip` contains the 111 Orcbrew
files and the manifest (112 members), with a verified ZIP CRC check.

| Source | Pack | Entries |
| --- | --- | ---: |
| VGM | Volo’s Guide to Monsters | 183 |
| MTF | Mordenkainen’s Tome of Foes | 155 |
| MPMM | Mordenkainen Presents: Monsters of the Multiverse | 291 |
| MM | Monster Manual (2014) | 527 |
| XMM | Monster Manual (2025) | 506 |

Editions and reprints remain separate definitions. File names use full source
titles with Windows-invalid characters replaced, plus the source ID in brackets.

## Completed website migration

Initial live checks confirmed only Book of Shadows and all-content packs.
Book of Shadows exported 47,452,540 bytes, exact SHA-256
`4b6e5186ef1d20901d64e570c173ef90a4a606fd4c83b22f26690b46d02c9f3d`.
The imported compact monster index contained 5,622 entries.

The first source-pack import failed before creating any pack. Runtime logs show
`MongoWaitQueueTimeoutError`; repeated POSTs fail immediately while GET reads
succeed. Mongoose's `Model.init()` retains its first rejected initialization
promise. The import route now uses `ensureContentIndexes()`, a shared explicit
index-creation promise which resets after failure. An import is still rejected
if index creation fails, preserving the unique source-hash requirement.

The fix passed 15 targeted tests (one optional external fixture skipped), and
server typecheck passed. The release thread incorporated it into the combined
Maps/theme/monster source, commit `e793511`, deployment
`dpl_CLwH63tmKL4T3mhZTS6nfimw7Tjc`, published at
https://dndoldal.vercel.app. Root publishing remains paused; future deployments
must use the combined branch source to preserve Maps. No deployment or promotion
was performed from this root workspace during the source-pack reorganization.

All 111 imports then succeeded. Every live source-pack export matched its local
file's exact byte length and SHA-256 digest. The compact index was checked before
restoration: all 4,942 moved identities belonged to their correct source files.
Book of Shadows was subsequently restored using the reviewed current hash and
document revision. Its exported source matches the original 68,213 bytes and
SHA-256 `de8002722f5ae50362d649167c6e89bfa25f95a8fc9e7ec39d42ce8ee42a1b49`.

Final checks: 113 saved packs (111 source packs plus the two original files),
5,622 imported monster identities, no missing or added IDs and no incorrect
source-pack memberships. Book of Shadows has 15 entries and no monsters.
The separate all-content file remains byte-identical to its original 3,878,980
bytes, SHA-256 `e9958e316f363827f42b65198bcfa99569c378eedc4cac12f3c4a0aedbe9a96f`,
including its existing 680 monsters. The standard SRD library remains available.

The rebuilt compact index took 8.32 seconds and a full pack list 6.40 seconds in
the final checks; these observations are not latency guarantees. A fresh UI
shows 3,833 creature groups / 5,956 source entries without alerts.
Both Aboleths, VGM Abjurer and MTF/MPMM Duergar Soulblade full-detail requests
resolved to their respective source files (observed warm requests 105–149 ms).
The fresh Aboleth reader retained Info, Artwork and Regional effects controls,
lair/regional text, and the Night/Parchment selector without horizontal overflow.
`live-imports.json`, `pre-restoration-verification.json` and
`live-verification.json` retain the migration results alongside the portable
artifacts. Keep compression-compatible rollback support: the 2014 Monster
Manual pack still exceeds the plain-storage threshold. T3 Code was not restarted.
The loopback transfer service was stopped and its temporary payloads removed.

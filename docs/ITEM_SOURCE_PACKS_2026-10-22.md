# 5etools item source packs — 2026-10-22

User-authorized scope: add Items to the existing per-publication monster packs. Create a new pack only for a new source. Root deployment remains prohibited; use the combined Maps branch and coordinate publication.

## Frozen support delta

Baseline: combined worktree ee7974c (pin implementation bb16b4a, then release docs).

Apply `.preview.local/item-release/01-compatible-caps.patch` first, commit it, build and stage a Ready **unpromoted fallback** before the item-support release. It retains pin settings and existing features while accepting the expanded collection: 128 MiB decoded, 14 MiB gzip-base64. Compression format and hashes are unchanged. The compressed cap leaves 2 MiB below MongoDB's 16 MiB document limit. Metadata remains bounded by existing validation.

Then apply `.preview.local/item-release/02-item-support.patch`. The patch manifest lists SHA-256 values. Both patches were applied sequentially to isolated baseline copies and compared with final source. Do not copy other root files wholesale. Optional ignore additions: `output/item-source-packs/` and `output/portable-orcbrew-export/`.

Items become native equipment/magic-item reference entries, with compact indexes and owner-scoped lazy details. The reader includes full resolved rules, statistics, source/page/link, and Info/Artwork when upstream provides them. Same-name source versions share a browse row with a source selector. Importing rules does not equip items or apply character effects. Unsupported source fields remain preserved in `:codex/item`.

## Source and pack coverage

- Captured 5etools 2.38.0 Items using `Renderer.item.pBuildList()` and `Renderer.item.pGetFluff()`, including generated specific variants and inherited rules.
- 6,603 items, 80 sources, zero capture failures or source/name collisions.
- 1,165 mundane and 5,438 magic items; artwork on 1,820 records and lore on 26.
- 67 existing source packs enriched, 13 new packs. Other existing packs remain unchanged.
- All original nonitem definitions and entry indexes checked for exact canonical equality. Every item's full retained record checked against capture.
- Projected collection: 126 files, 5,622 unchanged monsters plus 6,603 new items.

Local source: `.preview.local/5etools-items-resolved.json`. Regenerator: `scripts/build-item-source-packs.ts`. It uses the actual live export snapshot `output/portable-orcbrew-export/All homebrew.orcbrew`, validates source identities and duplicate/index collisions, and refuses to append items to an already item-bearing base pack without review.

Artifacts: `output/item-source-packs/manifest.json`, individual `.orcbrew` files, `All content with items.orcbrew`, `storage-qa.json`; guarded API payloads in `.preview.local/item-pack-transfer/`.

Projected combined file: 90,064,174 decoded bytes; 14,068,744 gzip-level-9 base64 bytes (14,158,808 at default gzip). Stored BSON fixture: 14,069,014 bytes. SHA-256 `c79f9dc29fa1e7c1a9a4bb3d5f8be897062e2934e071f65fd1bfd5d104421ae3`. Current 64/12 MiB release cannot export the entire expanded collection. Never roll back below the 128/14 compatible fallback after migration.

## Validation

Frontend build and server typecheck passed. Full final-corpus HTTP import → export → canonical original comparison → recipient reimport passed (24 tests passed, one unrelated optional fixture skipped). Subsequent targeted helper/storage/route checks passed (23 passed, two optional fixtures skipped); later changes only reset the reader panel and do not change serialization.

Local browser DOM review loaded all 5,438 magic indexes, lazily fetched selected details, grouped Bag of Holding as two source versions and showed 2014 weight 15 lb versus revised weight 5 lb. Artwork loaded at natural width 560. Native preview snapshot repeatedly timed out and viewport measurements were inconsistent; independent screenshot/mobile review remains for the combined release coordinator. These local fixtures do not use or mutate a database.

## Live migration gates

No live item writes at source freeze. Wait for combined item-support Ready/promoted and compatible fallback Ready. Back up current live pack list and exact exports. Compare current existing pack hashes with `expectedHash` before replacing; refuse changed packs. Replace 67 affected source packs and create 13 new ones, checkpoint every result, and verify downloaded hashes afterward. Use the existing chunked transfer protocol when needed. Never import the aggregate into the owner library as an extra pack.

After migration verify per-pack source placement/counts, 126 total files, 6,603 items, unchanged original monster identities, unchanged unrelated files and full combined export. Any retry must recognize already-applied desired hashes and never overwrite conflicting edits. Live exports and browsing are read-only QA; reimport checks use disposable local fixtures only.

## Live migration outcome (10:10 UTC)

Combined support e402734, Ready/promoted `dpl_6q3Q4v1sGYrXd5s7p32uX9SHXeZm`; compatible cap-only fallback `dpl_HCtLBHDQh1VfAdS51TmdDA38WKYt` remains Ready/unpromoted. Root publishing remains held.

Fresh pre-migration live backup exactly matched preparation SHA-256 `f82dd28cade54e160a294cf3409c27d12a52977a0081d0c76727668344daa540`. All 80 packs saved and immediately exported for exact SHA verification: 67 replacements and 13 creations, 69.641 seconds, no conflicts. Checkpoint and mapping: `output/item-source-packs/live-migration-checkpoint.json` and `live-imports.json`.

Live API verifies 126 files, 1,165 mundane items, 5,438 magic items, 80 item sources and all expected item indexes. Sample full details verified Bag of Holding DMG15lb/XDMG5lb, Flame Tongue Longsword fire/base filters, Deck of Many Things table text, Adventurer's Ring lore/art and PHB Longsword. Live UI source switch and artwork load at natural width560 passed.

Immediately after migration, concurrent index/list requests took18.5–20.4seconds; first selected detail11.6seconds; subsequent details118–271ms and warm magic index423ms. These are observed browser timings, not guaranteed cold/warm service bounds.

Giant server export returned500. Vercel logs confirmed the instance ran out of memory, not a parser rejection. One retry already started before the diagnosis also failed; no further aggregate requests until a bounded export fix. The release coordinator is handling that fix in the combined branch.

All126 individual exports were independently downloaded and combined client-side for full canonical verification: 90,064,219bytes, SHA-256 `1f1e9deae418d94810733fe779cae77e890dfdaa6b0eb66def7f559d329009fe`. `live-export-qa.json` confirms all5,622original monster indexes/definitions unchanged, all6,603items match expected source packs, all46unrelated packs unchanged, and full canonical equality with projected data. Formatting differs from the projected aggregate, hence a different aggregate byte hash.

### Final export repair and verification (10:22 UTC)

The combined branch published bounded-export implementation8ea47e2 as Ready/promoted deployment `dpl_8AgXuPqDP8PuEhVc92datBg6Mzfe`. Export validates individual source maps without rebuilding normalized catalogs or reparsing the aggregate. Parser shape/depth checks and recipient compression-fit validation remain. The previous item-support deployment `dpl_6q3Q4v1sGYrXd5s7p32uX9SHXeZm` is the compatible fallback.

Exactly one authenticated aggregate request after that release returned HTTP200 in12,060ms, started2026-10-22T10:21:10.044Z. Result90,064,161bytes, SHA-256 `ed8fca89b824f696aaadf79368a8249bf6fbe715b998a7870c958bc2ca86df1e`, exactly matching the local profile output. Local final canonical verification passed all126maps, all5,622original monster identities/definitions,1,165mundane+5,438magic items and46unchanged unrelated packs. Evidence: `bounded-export-live-qa.json`, `live-export-qa.json`, and `Post-items homebrew.orcbrew` in the output directory.

Coordinator validation includes frontend build/server typecheck, exact126raw-map-slice equality, warm export memory profiles below the actual2048MiB function limit, and a recipient importer/storage roundtrip of the90MBaggregate (13,752totalentries). No live recipient import was performed.

Task complete. The affected80source files are also available in `output/item-source-packs/5etools items by source.zip`. No further data writes or root deployments are required. T3 Code was not restarted.

# Notebook listing optimization / 2 November 2026

Implemented locally; not deployed. Production measurements and production migration were not performed. No application database contents or existing indexes were changed. All populated-data mutations were restricted to unique loopback fixture databases, verified by host/name guards and removed afterward.

## Baseline and dominant work

The original populated baseline was captured before schema/source changes or migration: 3,600 notebook entries, one folder, DM/player permissions, 60 imported packs and 1,500 imported definitions. That capture is retained in [baseline-pre-migration.json](../../.local/notebook-query-20261102/baseline-pre-migration.json). Its shallow all-section listing took 130.6 ms DM / 69.3 ms player, with 7,560,032 / 3,796,091 bytes of projected BSON entry documents. Original navigation counts share this same read; they do not have a separate database query. Access/folder reads are tiny by comparison. The independent Compendium cache-miss request took 124.1 ms; warm reads took 9.3-13.7 ms. These single-environment observations identify notebook full-entry transfer and uncached Compendium work as the main costs, not a universal production ranking.

For execution-plan comparisons, the same original route was reproduced from Git ref 9d2c605555bdb9eb364eeb60d3450a61cca218bd, with automatic schema/index creation disabled, on a fresh unbackfilled fixture. The original route blob is 6c43b5a169de3a40fcc6b7bca8e71bf848e07340. The following tables use that repeat baseline and the final candidate, each with one warm-up and three timed requests per case. The final baseline/candidate timing pair ran sequentially without concurrent typechecks/tests. Timing varies with local load (the first DM baseline and later repeat differ appreciably); these are feasibility measurements, not production speed guarantees. The initial evidence was retained rather than replaced.

## Implemented behavior

- Empty-search requests use database visibility/filtering, Hungarian title ordering, skip and limit (60), with an include-list projection excluding body, clues and images. Mixed browsing is alphabetical as explicitly approved; the Sessions view remains chronological.
- Navigation/counts use a separate facet aggregation, a separately measured total-count operation, and an indexed chronological session-link read. They retain section-wide scope independently of page filters. All aggregate permission IDs are BSON ObjectIds; ordinary find queries retain Mongoose casting.
- No excerpt was added. Derived metadata stores effective legacy category, event/status values, source session numbers, a scalar chronological key, and normalized tag names/keys. One shared function is called for creates, every query update, delete/recover, and text-only version restoration.
- Missing derived versions retain the existing reader; a second row-level check handles an unmigrated record arriving between readiness and page reads. Consistency checking detects drift; no automatic request-time migration occurs.
- Existing search matching, clue visibility, normalization and search ordering remain unchanged. Trash, pinned IDs, folders/subtrees, character filters and counts remain available.
- Four additive indexes with collation { locale: 'hu' }: alphabetical with/without section and chronological Sessions with/without section. Existing indexes remain. This adds storage/write maintenance; none were created in production.

## Timings and payloads / fixtures only

HTTP is the uncompressed UTF-8 response body, not headers or browser rendering time. DB bytes are the summed BSON sizes of returned documents across initial/cursor batches, not compressed wire traffic or stored bytes. Navigation DB bytes below exclude the tiny access/folder context. The HTTP bodies have equivalent parsed contracts in all 24 cases; field serialization order can differ. Median driver command durations include delivery and may overlap, so they must not be added to HTTP duration.

| Role | Section | Order | Offset | HTTP ms before / after | DB listing bytes before / after | DB navigation bytes after | HTTP bytes before = after |
|---|---|---|---:|---:|---:|---:|---:|
| DM | all | alphabetical | 0 | 136.4 / 58.1 | 7,560,032 / 26,486 | 511,355 | 483,359 |
| DM | all | alphabetical | 360 | 125.4 / 52.6 | 7,560,032 / 26,619 | 511,355 | 483,584 |
| DM | all | sessions | 0 | 131.5 / 52.7 | 7,560,032 / 26,460 | 511,355 | 483,487 |
| DM | all | sessions | 360 | 126.2 / 53.5 | 7,560,032 / 26,460 | 511,355 | 483,556 |
| DM | journal | alphabetical | 0 | 97.9 / 43.0 | 5,048,240 / 26,486 | 511,287 | 483,355 |
| DM | journal | alphabetical | 360 | 83.0 / 42.8 | 5,048,240 / 26,543 | 511,287 | 483,428 |
| DM | journal | sessions | 0 | 84.4 / 43.9 | 5,048,240 / 26,460 | 511,287 | 483,483 |
| DM | journal | sessions | 360 | 85.3 / 41.7 | 5,048,240 / 26,460 | 511,287 | 483,552 |
| DM | story-items | alphabetical | 0 | 41.7 / 12.0 | 2,511,792 / 26,617 | 305 | 24,325 |
| DM | story-items | alphabetical | 360 | 41.7 / 12.3 | 2,511,792 / 26,661 | 305 | 24,392 |
| DM | story-items | sessions | 0 | 44.4 / 11.2 | 2,511,792 / 0 | 284 | 519 |
| DM | story-items | sessions | 360 | 39.5 / 10.8 | 2,511,792 / 0 | 284 | 519 |
| PLAYER | all | alphabetical | 0 | 71.3 / 33.2 | 3,796,091 / 26,666 | 256,219 | 254,097 |
| PLAYER | all | alphabetical | 360 | 67.8 / 31.8 | 3,796,091 / 26,682 | 256,219 | 254,330 |
| PLAYER | all | sessions | 0 | 71.0 / 34.1 | 3,796,091 / 26,490 | 256,219 | 254,194 |
| PLAYER | all | sessions | 360 | 66.9 / 31.2 | 3,796,091 / 26,490 | 256,219 | 254,247 |
| PLAYER | journal | alphabetical | 0 | 48.3 / 32.2 | 2,539,903 / 26,666 | 256,151 | 254,095 |
| PLAYER | journal | alphabetical | 360 | 47.4 / 29.4 | 2,539,903 / 26,499 | 256,151 | 253,956 |
| PLAYER | journal | sessions | 0 | 47.9 / 29.5 | 2,539,903 / 26,490 | 256,151 | 254,192 |
| PLAYER | journal | sessions | 360 | 47.9 / 28.6 | 2,539,903 / 26,490 | 256,151 | 254,245 |
| PLAYER | story-items | alphabetical | 0 | 25.0 / 11.1 | 1,256,188 / 26,658 | 305 | 24,264 |
| PLAYER | story-items | alphabetical | 360 | 23.5 / 11.2 | 1,256,188 / 26,490 | 305 | 24,107 |
| PLAYER | story-items | sessions | 0 | 25.5 / 8.9 | 1,256,188 / 0 | 284 | 417 |
| PLAYER | story-items | sessions | 360 | 22.9 / 8.6 | 1,256,188 / 0 | 284 | 417 |

## Execution plans / fixtures only

The following are separate executionStats measurements, outside the HTTP timing interval. Navigation columns sum the facet input scan, total-count scan and session-link scan. Counts necessarily inspect/index-count the wider visible set; they are not page reads. All 24 active-page plans and their navigation/session read plans contain no blocking SORT stage. Page plans select the named notebook_title_hu, notebook_section_title_hu, notebook_session_hu and notebook_section_session_hu indexes, with query collation { locale: 'hu' }. Empty Sessions results in story-items are intentionally included (0 examined/returned), not evidence for populated session performance in that section.

| Role | Section | Order | Offset | Page returned | Page docs before / after | Page keys before / after | Navigation docs after | Navigation keys after | Blocking SORT after |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| DM | all | alphabetical | 0 | 60 | 3,600 / 60 | 3,600 / 60 | 4,758 | 8,233 | No |
| DM | all | alphabetical | 360 | 60 | 3,600 / 420 | 3,600 / 420 | 4,758 | 8,233 | No |
| DM | all | sessions | 0 | 60 | 3,600 / 60 | 3,600 / 60 | 4,758 | 5,916 | No |
| DM | all | sessions | 360 | 60 | 3,600 / 420 | 3,600 / 420 | 4,758 | 5,916 | No |
| DM | journal | alphabetical | 0 | 60 | 2,400 / 60 | 2,400 / 60 | 3,558 | 5,875 | No |
| DM | journal | alphabetical | 360 | 60 | 2,400 / 420 | 2,400 / 420 | 3,558 | 5,875 | No |
| DM | journal | sessions | 0 | 60 | 2,400 / 60 | 2,400 / 60 | 3,558 | 4,716 | No |
| DM | journal | sessions | 360 | 60 | 2,400 / 420 | 2,400 / 420 | 3,558 | 4,716 | No |
| DM | story-items | alphabetical | 0 | 60 | 1,200 / 60 | 1,200 / 60 | 1,200 | 2,358 | No |
| DM | story-items | alphabetical | 360 | 60 | 1,200 / 420 | 1,200 / 420 | 1,200 | 2,358 | No |
| DM | story-items | sessions | 0 | 0 | 1,200 / 0 | 1,200 / 0 | 1,200 | 1,200 | No |
| DM | story-items | sessions | 360 | 0 | 1,200 / 0 | 1,200 / 0 | 1,200 | 1,200 | No |
| PLAYER | all | alphabetical | 0 | 60 | 3,600 / 119 | 3,600 / 119 | 8,235 | 8,237 | No |
| PLAYER | all | alphabetical | 360 | 60 | 3,600 / 837 | 3,600 / 837 | 8,235 | 8,237 | No |
| PLAYER | all | sessions | 0 | 60 | 3,600 / 118 | 3,600 / 118 | 5,917 | 5,917 | No |
| PLAYER | all | sessions | 360 | 60 | 3,600 / 840 | 3,600 / 840 | 5,917 | 5,917 | No |
| PLAYER | journal | alphabetical | 0 | 60 | 2,400 / 119 | 2,400 / 119 | 8,235 | 8,237 | No |
| PLAYER | journal | alphabetical | 360 | 60 | 2,400 / 841 | 2,400 / 841 | 8,235 | 8,237 | No |
| PLAYER | journal | sessions | 0 | 60 | 2,400 / 118 | 2,400 / 118 | 5,917 | 5,917 | No |
| PLAYER | journal | sessions | 360 | 60 | 2,400 / 840 | 2,400 / 840 | 5,917 | 5,917 | No |
| PLAYER | story-items | alphabetical | 0 | 60 | 1,200 / 119 | 1,200 / 119 | 2,358 | 2,358 | No |
| PLAYER | story-items | alphabetical | 360 | 60 | 1,200 / 837 | 1,200 / 837 | 2,358 | 2,358 | No |
| PLAYER | story-items | sessions | 0 | 0 | 1,200 / 0 | 1,200 / 0 | 1,200 | 1,200 | No |
| PLAYER | story-items | sessions | 360 | 0 | 1,200 / 0 | 1,200 / 0 | 1,200 | 1,200 | No |

Shallow DM pages examine exactly the 60 returned documents. Player visibility needs roughly 118-119 examinations for 60 results. At offset 360, DM pages examine 420 and player pages approximately 837-841 records: skip remains linear and the examined/returned ratio is not near one on deep pages. This is reported as a limitation, not a passed efficiency target. The no-SORT assertion applies to the tested active query shapes; Trash range filters and other combinations have no universal no-SORT guarantee.

Navigation/count/session links dominate the candidate's remaining database work. In the shallow all-section DM case they return 511,355 BSON bytes, versus 26,486 for the page. The complete HTTP body remains large because it still includes every visible session link; shrinking that would change the response contract and is deferred.

## Compendium measured independently

No Compendium runtime code was changed. Each run starts a fresh application process and independent database. The first read is an application-cache miss, not a platform/connection cold-start measurement. The fixture uses the legacy reader explicitly; it is not a reproduction of the production prepared-component path.

| Variant | Cache | HTTP ms | DB BSON bytes | HTTP body bytes |
|---|---|---:|---:|---:|
| Original | application-cache-miss | 118.1 | 1,118,070 | 13,287 |
| Original | warm | 9.9 | 10,140 | 13,287 |
| Original | warm | 8.3 | 10,140 | 13,287 |
| Original | warm | 7.8 | 10,140 | 13,287 |
| Candidate | application-cache-miss | 109.9 | 1,118,070 | 13,287 |
| Candidate | warm | 9.4 | 10,140 | 13,287 |
| Candidate | warm | 8.9 | 10,140 | 13,287 |
| Candidate | warm | 8.1 | 10,140 | 13,287 |

## Verification and evidence

- 24 populated matrix cases: DM/player / all/journal/story-items / alphabetical/Sessions / offsets 0/360.
- 34 additional real-Mongo HTTP contract comparisons: categories, quest states, events, normalized tags, folders, character filters, pinned IDs, Trash and unchanged body/clue search. Original and candidate parsed contracts match on the controlled fixtures.
- Real-Mongo migration/check, missing-metadata fallback, deliberate metadata drift detection and repair pass. Shared-function and resumable-backfill tests cover conditional-update conflicts below the checkpoint cursor and unchanged source revision/timestamps. Existing route tests assert metadata consistency after every exercised write path.
- 60 focused tests across seven files pass; runtime-only backend TypeScript checking passes. Full server typecheck is blocked by an existing error in server/extension/model-readiness.test.ts:62 (missing rememberedConnections in its ProductionTrialConfig fixture). That unrelated file was already modified before this task and was not changed.
- Raw evidence: [original repeat](../../.local/notebook-query-20261102/baseline.json), [candidate](../../.local/notebook-query-20261102/after.json), [interactive chart](../../.local/notebook-query-20261102/performance.html). Full per-command stage durations, BSON sizes, returned rows and executionStats are retained, including navigation and access.

## Backfill and rollout

The CLI defaults to read-only consistency checking. Configure the intended database through MONGO_URI/MONGODB_URI; do not put credentials in command arguments. Commands from the repository root:

```powershell
node --import ./server/node_modules/tsx/dist/loader.mjs server/scripts/backfill-notebook-listing.ts --check
node --import ./server/node_modules/tsx/dist/loader.mjs server/scripts/backfill-notebook-listing.ts --apply --batch-size=200 --max-batches=10
node --import ./server/node_modules/tsx/dist/loader.mjs server/scripts/backfill-notebook-listing.ts --apply --batch-size=200
node --import ./server/node_modules/tsx/dist/loader.mjs server/scripts/backfill-notebook-listing.ts --check
```

Deploy the shared writers first and allow older writers to drain; verify the named Hungarian indexes are ready before assessing sort plans. Then backfill, repeat --apply to resume, and finish with a fresh full --check. Writes match both _id and revision and modify listing metadata only. Source prose, sharing, timestamps, revisions and history are preserved. Conflicts are retained in the checkpoint and retried even when below its high-water _id. A checkpoint is bound to database/room/version. Use one process per checkpoint. To repair drift below a completed cursor, use a fresh --checkpoint path and then a full --check. A bounded --max-batches run intentionally need not be complete.

Neither the deployment nor any real-data backfill was performed. Production timing, actual index selection and transfer savings remain unmeasured.

To repeat the fixture comparison, set NOTEBOOK_BASELINE_REF to the original Git ref above, then run `node --import ./server/node_modules/tsx/dist/loader.mjs scripts/benchmarks/notebook-performance.mjs baseline` followed by the same command with `after`. The benchmark pins the original reader for baseline, disables automatic model indexing, creates/drops unique local databases, and never uses the configured application database. The consistency CLI also passed its read-only smoke check against the empty local notebook collection; this is not populated-data verification.

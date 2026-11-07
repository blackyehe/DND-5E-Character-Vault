# Controlled performance follow-up — 2 November 2026

There is measurable value in the work. Under controlled API responses, the released frontend improves sheet readiness while creator readiness is essentially unchanged despite fewer dynamic requests. The other agent's waterfalls and notebook read path show reproducible gains in their tested conditions. This is **not** proof that every change is a site-wide net positive: notebook first-load latency sensitivity, added index/write costs and the actual user workload remain material limits.

The first small browser comparison did not establish a code regression. This follow-up compares the latest released batch with its immediate predecessor, plus the other agent's local notebook/waterfall work. It is not a complete replay of every change from the past week.

## What was controlled

- Hosted: both immutable deployment hostnames, both fra1, same authenticated account/character, balanced alternating order, 12 paired observations per view and one excluded warmup per version/view. Fresh client storage; the same request interception on both releases. Server cache/instance placement, network and platform delays remain uncontrolled. Before: dpl_DrPd5jzRBe7HhLXoavzdPV9QgpQy; after: dpl_ExfrJQJhALMYa3EJyB6Wd8MupCFf.
- Frontend replay: actual frontend assets from those immutable releases, one loopback origin, one browser build/viewport, the same authorized API snapshot held in process memory, configured 200 ms delay per API request, static assets prefetched in the proxy, original API cache-control headers, external HTTPS and category-index work excluded. Snapshots were frozen before timed runs; every timed request had to match the snapshot. Fresh storage and same-context revisit cohorts were separate. No private API body was written to an artifact.
- Other agent: actual frozen-before/current Vue setup and Express room route code with identical synthetic responses. Ten pairs each with 0 or 100 ms per API/DB call. Vue uses a renderless test renderer, so these are waterfall/mechanism measurements, not browser DOM, real Mongo or production network timings.
- Notebook: same retained 3,600-entry loopback Mongo fixture, same indexes/process/authorization, approved alphabetical semantics, flag-off legacy versus flag-on readers, 12 observations per role/mode, balanced rotating order. Responses are hash-compared, including full navigation and split pages. Indexes/data were not rebuilt or reseeded. A second matrix adds wire latency without inspecting or buffering payloads.
- All comparisons use nearest-rank percentiles. Delta is paired after-minus-before; negative means faster. Bootstrap intervals use 10,000 reproducible paired resamples. Small samples and unobserved host/cache behavior limit inference; these intervals are exploratory, not causal proof or a production tail guarantee. Separate cohort p50 differences can differ from the median paired delta.

There were 48 hosted timed observations (+4 excluded warmups), 80 opening replays, 20 Compendium replay records, 200 waterfall observations and 96 + 96 notebook observations. Warmup/priming visits are excluded. Existing focused tests also passed: 33 across four files. The new actual-source waterfall benchmark checked matching responses throughout 200 observations.

## Released frontend and hosted behavior

| Hosted view; 12 pairs | Before p50 ms | After p50 ms | Paired delta ms | Bootstrap interval ms | Before/after max ms |
| --- | --- | --- | --- | --- | --- |
| creator | 1,457 | 1,841 | -7 | -968 to 1,028 | 17,076 / 10,512 |
| sheet | 1,770 | 1,862 | -312 | -1,051 to 474 | 8,558 / 4,386 |

Both hosted paired intervals include zero. The before release itself reached 17.08 seconds for creator and 8.56 seconds for sheet. One slow document had a 3.03-second first-byte wait and a 2.66-second script resource wait. The slow current creator had a 2.21-second document first-byte wait. These are observed delays, not proof of a function cold start or a particular infrastructure cause. Neither a broad production regression nor a broad production speedup is established.

| Same-origin frontend replay; 10 pairs | Client state | Before p50 ms | After p50 ms | Paired delta interval ms | API requests before → after |
| --- | --- | --- | --- | --- | --- |
| creator | fresh-storage | 560 | 560 | -6 to 5 | 7 → 2 |
| sheet | fresh-storage | 1,684 | 1,063 | -634 to -616 | 10 → 9 |
| creator | same-context-revisit | 545 | 543 | -4 to 1 | 7 → 2 |
| sheet | same-context-revisit | 942 | 865 | -91 to -76 | 9 → 8 |

The controlled sheet improvement is about 37% for fresh storage and about 8% on a revisit; paired intervals stay below zero. Creator p50 is 560 → 560 ms fresh and 545 → 543 ms revisiting. Its five standard-list requests become a cacheable public asset, reducing dynamic calls 7 → 2, but the remaining API work still controls readiness in this model. That is a request/load improvement, not a demonstrated creator page-time win. The actual API bodies are retained in memory, but payload-dependent server work and real network bandwidth/cold asset transfer are not modeled by a fixed response delay. Static assets here were prefetched; do not substitute these replay numbers for production loading times. Frontend replay also does not isolate backend timing-monitor overhead.

## Released Compendium changes

| Compendium replay; 5 pairs | Before preload ms | After preload ms | Preload delta interval ms | Warm click before / after ms | New-tab click before / after ms | New-tab full-detail requests before → after |
| --- | --- | --- | --- | --- | --- | --- |
| spells | 5,634 | 5,630 | -23 to 29 | 19 / 18 | 327 / 328 | 1 → 0 in every pair |
| classes | 3,946 | 3,945 | -41 to 28 | 59 / 88 | 329 / 329 | 1 → 0 in every pair |

Full visible-page preload time is effectively unchanged under this model, and first-view API body amounts match: 71,474 bytes for the spell scenario and 225,806 for classes (including supporting calls). Both versions already make zero full-detail calls on clicks after memory preloading. Current persistence avoids the full-detail request for an **unclicked** preloaded entry opened in a new tab: 0 versus 1, in all five pairs for each category. New-tab click time remains about 329 ms because freshness work still runs. This proves avoided full-definition transfers, not zero network traffic or guaranteed quicker new-tab clicks. Exact new-tab byte savings were not recorded and are not guessed.

Current warm class-click median was 88 ms versus 59 ms; its paired interval is -36 to +34 ms and both ranges overlap (roughly 54–93 ms). This sample does not resolve a consistent small click-cost change. Optional IndexedDB writes have resource cost, especially on other devices; no low-end/mobile CPU or disk conclusion is claimed.

## The other agent's waterfall work

| Other-agent actual code; 10 pairs | Role | Before p50 ms | After p50 ms | Requests before → after | Paired delta interval ms |
| --- | --- | --- | --- | --- | --- |
| items | personal | 234.7 | 124.87 | 2 → 2 | -111.46 to -108.47 |
| notebook | dm | 233.92 | 124.72 | 2 → 2 | -110.79 to -107.32 |
| notebook | player | 343.36 | 124.12 | 3 → 2 | -221.33 to -217.5 |
| room | dm | 327.05 | 218.66 | 1 → 1 | -112.28 to -107.32 |
| room | player | 327.74 | 217.53 | 1 → 1 | -110.65 to -107.61 |

The 100 ms delays are a model applied equally to each underlying call; the gains are not production millisecond forecasts. Requests remain 2 → 2 for items and DM notebook, while overlapping removes a wait. Player notebook drops 3 → 2. Room detail remains one HTTP request and three DB queries, with independent member/character reads overlapping only after authorization. The 0 ms cohort is retained in summary.json. All tested before/after response contracts match. Existing tests cover debounce/cancellation, stale responses, access loss and role behavior.

## The other agent's notebook database work

| Real Mongo, local fixture; 12 pairs | Mode | HTTP p50 ms | DB command sum p50 ms | BSON bytes | HTTP body bytes | DB commands | Docs / keys examined |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dm | legacy-full | 155.47 | 49 | 8,188,526 | 483,359 | 5 | 3,604 / 3,604 |
| dm | indexed-full | 53.1 | 37 | 538,417 | 483,359 | 8 | 4,822 / 8,297 |
| dm | indexed-repeat | 5.33 | 4 | 26,952 | 23,626 | 5 | 64 / 3,539 |
| dm | indexed-initial | 49.78 | 36 | 538,417 | 483,386 | 8 | 4,822 / 8,297 |
| player | legacy-full | 82.08 | 29 | 4,116,172 | 254,097 | 5 | 3,604 / 3,604 |
| player | indexed-full | 35.03 | 28 | 283,402 | 254,097 | 8 | 4,880 / 6,618 |
| player | indexed-repeat | 5.54 | 4 | 27,110 | 23,702 | 5 | 122 / 1,860 |
| player | indexed-initial | 33.76 | 29 | 283,402 | 254,124 | 8 | 4,880 / 6,618 |

This test compares the legacy reader with the indexed reader, not just the new full indexed response with its slim variant. The earlier 55 ms full-response control was already using the indexed reader. That earlier comparison measured the incremental navigation split and should not be read as the entire rewrite's first-load gain.

On the local fixture, default full response improves 155.47 → 53.10 ms DM and 82.08 → 35.03 ms player, with identical full JSON contracts and body sizes. Shared initial is 49.78/33.76 ms; slim repeat is 5.33/5.54 ms when navigation is reusable. DB BSON payload drops 8,188,526 → 538,417 bytes DM and 4,116,172 → 283,402 bytes player for the full response. Slim pages return 26,952/27,110 BSON bytes and 23,626/23,702 HTTP body bytes.

The tradeoff is real: full responses use eight DB commands versus five, and examine more aggregate documents/keys even while returning far less BSON and doing less JS derivation. Repeat pages examine 64/122 documents. Command durations can overlap; subtracting their sum from HTTP duration would not measure CPU. BSON cursor bytes and uncompressed HTTP body bytes are separate metrics, neither the compressed database-wire size nor CDN transfer size.

## Latency stress: a limit on first-load gains

The streaming relay injects a requested 50 ms before each Mongo message prefix in both directions, with TCP_NODELAY. Actual injected message-delay p50 was 61.49 ms, so the nominal 100 ms added RTT was about 122.98 ms in this environment. Timer jitter is reported, not hidden. No payload was inspected, copied as a whole or recorded. This is an artificial sensitivity test, not production latency.

| Added-delay Mongo model; 12 pairs | Legacy full ms | Indexed full ms | Slim repeat ms | Full paired delta / interval ms |
| --- | --- | --- | --- | --- |
| dm | 769.36 | 782.66 | 493 | 10.05 / 7.65 to 15.5 |
| player | 698.5 | 769.5 | 503.28 | 70.7 / 63.24 to 77.48 |

At this modeled latency, full player first load is about 71 ms slower; full DM about 10 ms slower by paired median. Slim repeat still saves about 200–280 ms. The extra first-load query dependency phases can outweigh the BSON/CPU savings when RTT is high. This is a reason to consider flattening the independent first-load queries before rollout, rather than discarding the repeat-read work or declaring the whole notebook rewrite unconditionally positive.

For context only, 48 earlier controlled production notebook requests had median per-request average monitored-command duration 3 ms, range 2–12.25 ms. That includes execution/transfer, is not pure RTT, and uses a smaller library with the legacy reader. It does not establish future indexed production cost or a cold-start bound. The roughly 123 ms injected RTT is a stress condition rather than an observed normal production RTT.

The earlier 32-case query matrix remains relevant: core 24 plans avoid blocking SORT; DM Trash and finished-quest filters for both roles still have the same three SORT plans. This task did not add hints/indexes or change queries to hide them. Added index storage/maintenance and transactional room-counter write latency are still unmeasured on production. Thus the proof is for the measured read/startup cases, not the entire read/write workload.

## Decision and preserved evidence

The evidence supports retaining useful work, not a blanket rollback. Released sheet frontend changes have a controlled path-level gain. Creator selection lists reduce dynamic requests without a time win in this fixed-delay model. Persistent preloads avoid repeat full-detail downloads but do not speed every click. The other agent's waterfalls and repeat notebook reads have clear tested benefits. Improve or verify the notebook first-load dependency chain and write/index costs before its separate rollout; it remains undeployed.

No application source/configuration, production index, migration, authoritative content or deployment was changed. Tests made authorized GETs; existing server cache maintenance remained normal. Temporary browser contexts, in-memory snapshot proxy, loopback API servers and Mongo relay were closed. Reports contain timing/count data rather than titles, user IDs, credentials or entry text. The timing exporter was renewed/run after testing; its result was 0 new records and zero reported gaps/exclusions. Immutable-host and local traffic are excluded from that canonical-domain collector.

An initial warm-revisit replay waited for a reference HTTP request that a valid cache hit can avoid. Its failed attempt was preserved, the readiness check corrected for warm revisits, and the full predeclared sample set rerun. An initial latency-relay run is also preserved; final results use TCP_NODELAY and measured injected delays. Neither attempt changed application code, and incomplete replay observations were not merged into the final sample.

Source thread for the other agent: <t3-thread://v2/0c1692f6-7358-400e-b59e-6e30e1c1dd9d/f27e812f-75be-4181-b12b-75d51eb9a75f>. Released-batch context: <t3-thread://v2/0c1692f6-7358-400e-b59e-6e30e1c1dd9d/d394d989-41b2-4e29-ac7a-be7928b74133>.

Aggregate [summary JSON](../../.local/controlled-performance-20261102/summary.json) and [paired CSV](../../.local/controlled-performance-20261102/paired-comparison.csv). Individual timing artifacts and source-safe harnesses are in the same ignored directory. This follow-up supersedes the interpretation of the earlier small-sample comparison while preserving its measurements.

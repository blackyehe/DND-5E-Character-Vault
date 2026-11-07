# Performance comparison — 2 November 2026

Follow-up: [the better-controlled comparison](controlled-performance-2026-11-02.md) separates hosted variability, same-origin frontend replay, other-agent waterfalls and real-Mongo read/latency models. Keep the earlier measurements below as historical evidence.

The latest notebook candidate reproduces its previous query-work and payload results, and preloaded Compendium clicks remain fast. The creator makes fewer API requests, but this small browser comparison does **not** demonstrate an overall loading-time improvement: current page-ready medians were slower and variability was large. Notebook/waterfall changes remain local; production is still the isolated timing release.

## Scope and controls

Read the recent optimization and database-investigation threads, including their last measured results: <t3-thread://v2/0c1692f6-7358-400e-b59e-6e30e1c1dd9d/d394d989-41b2-4e29-ac7a-be7928b74133> and <t3-thread://v2/0c1692f6-7358-400e-b59e-6e30e1c1dd9d/f27e812f-75be-4181-b12b-75d51eb9a75f>.

Current production: dpl_ExfrJQJhALMYa3EJyB6Wd8MupCFf; prior release sampled for browser comparison: dpl_DrPd5jzRBe7HhLXoavzdPV9QgpQy. Both were READY. Tests started 2026-11-02T16:41:44.121Z; raw per-run timestamps are retained in the evidence. Same existing authenticated account and character, desktop Edge, fresh storage per view, retained server caches and alternating version order. Prior release used its immutable hostname; current used the public hostname. Host routing, network, server caches and optional data reconstruction were not controlled. Results are observations, not a causal code-regression or cold-start proof. No p95 is presented for three-run browser groups because it would just equal the maximum.

There were 12 page-opening observations, six current Compendium observations, 42 populated production notebook reads, and a 32-case synthetic loopback notebook matrix with one warmup and five timing samples per case. HTTP and DB timings were measured serially, without concurrently running the browser and database benchmark. No application source, deployment, migration, production index or authoritative content was changed. Existing GET handlers can perform their unchanged derived-cache maintenance. Existing local fixture data/indexes were reused without reseeding.

## Browser page openings

| Page ready, seconds (range) | Prior release, measured now; n=3 | Current release; n=3 | API requests, prior → current |
| --- | --- | --- | --- |
| creator | 2.41 (1.49–4.30) | 3.65 (1.23–6.06) | 7 → 2 |
| sheet | 2.26 (2.11–5.79) | 3.91 (1.44–7.54) | 10 → 9 |

The five standard-list API requests disappear from creator startup in all three current runs; sheet opening also avoids one list call. Current creator readiness ranged 1.23–6.06 seconds; current sheet readiness ranged 1.44–7.54 seconds. Remaining creation-options reads took 410–4,075 ms. Equipment-detail reads reached 2,285 ms, and one current sheet shell took 6,398 ms before its readiness marker. These are measured waits, not an attribution of their entire cost to MongoDB. The existing timing middleware does not cover creation-options, character/auth or equipment API endpoints, so those costs need targeted tracing before a database conclusion.

The most recent retained public observation of the already-published selection-list release was 1.286 seconds for creator and 3.452 seconds for sheet, each n=1. The 0.670-second creator number in the earlier thread was a review observation. None is a stable target or a suitable standalone before/after speedup claim.

## Compendium: real account, current public site

| Actual-library measure | Nov 1 retained observation; n=1 | Current median (range); n=3 |
| --- | --- | --- |
| spells: visible details ready | 8.39 s | 8.23 s (7.41–8.64) |
| spells: preloaded click | 20.86 ms | 20 ms (19–23) |
| classes: visible details ready | 3.42 s | 4.41 s (3.27–9.89) |
| classes: preloaded click | 60.05 ms | 58 ms (56–60) |

All 25 visible spells and 18 visible classes loaded in each run. Warm clicks made zero full-detail requests. Spells used nine batch requests and 61,463 decoded body bytes; classes used six and 195,162 bytes. The public Nov 1 values are single retained observations, so small differences do not establish improvement/regression. Preloading still has a multi-second preparation cost; fast clicks apply after the value is ready.

## Notebook: local candidate only

The exact reader source hashes match the last retained count-optimization run. This re-test confirms existing results; it introduces no new optimization. All 32 default/split contracts match, covering both roles, sections, ordering, shallow/deep offsets, search, Trash, tags and quest state.

| Repeat-page fixture | Early slim ms | Last verified ms | Retest ms | DB BSON bytes | HTTP body bytes | Docs examined | Keys examined | DB trips |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dm | 9.23 | 5.72 | 5.53 | 26,952 | 23,626 | 64 | 3,539 | 5 |
| player | 9.29 | 4.38 | 4.54 | 27,110 | 23,702 | 122 | 1,860 | 5 |

Early slim → retest docs examined: DM 3,664 → 64; player 7,199 → 122. Keys: DM 7,139 → 3,539; player 7,201 → 1,860. Trips: 6 → 5. The most recent retained run already achieved the same examined-document/key counts; its 5.72/4.38 ms versus this run's 5.53/4.54 ms is approximately stable, not a fresh optimization gain. DB bytes are BSON cursor-document bytes, not compressed database-wire traffic; HTTP bytes are uncompressed JSON body bytes. DB command sums may overlap and must not be subtracted from HTTP elapsed time to claim CPU cost.

| Fixture role | Full default ms | Shared initial ms | Navigation ms | Full/default HTTP bytes | Slim repeat HTTP bytes |
| --- | --- | --- | --- | --- | --- |
| dm | 54.88 | 51.45 | 49.95 | 483,359 | 23,626 |
| player | 32.96 | 32.89 | 31.53 | 254,097 | 23,702 |

Repeat-page savings assume navigation can be reused. First load still carries navigation: 51.45 ms DM and 32.89 ms player. Navigation remains about 49.95/31.53 ms and 459,734/230,396 JSON bytes. Do not present slim-repeat time as a first-page loading time.

All 24 core section/order/offset query plans avoid blocking SORT. Three extra-filter plans still contain SORT, identically to the prior retained results:

| Existing fixture SORT case | Docs examined | Keys examined | Returned |
| --- | --- | --- | --- |
| dm: section=all&deleted=true | 125 | 127 | 60 |
| dm: section=all&type=quests&questStatus=finished | 267 | 267 | 0 |
| player: section=all&type=quests&questStatus=finished | 267 | 267 | 0 |

The finished-quest fixture returns zero rows; its SORT stage is still a plan limitation, not evidence of an expensive nonempty sort. These exceptions remain review items before claiming every no-search case is index-sorted. No hint, index or query was changed to hide them. Full 32-case measurements are in [the CSV matrix](../../.local/performance-comparison-20261102/notebook-fixture-matrix.csv); executionStats and winning plans are retained in the adjacent notebook/after.json artifact.

## Current production notebook and timing archive

| Current public notebook, all/no search/offset 0 | n | HTTP p50 ms | HTTP max ms | Decoded JSON bytes | Results |
| --- | --- | --- | --- | --- | --- |
| DM | 3 | 85.68 | 106.35 | 35,423 | 60 |
| player | 3 | 75.04 | 200.17 | 34,032 | 60 |

The production room is populated; player coverage used the owner's read-only player-preview mode. These are caller-observed HTTP times, not fixture times or server-handler durations. This public release still uses its previous notebook reader. The complete 14-cohort/42-request production HTTP matrix is in [the CSV](../../.local/performance-comparison-20261102/notebook-production-http.csv). It includes each section, Sessions, search, deep pages and link targets. Runtime DB payload and docs/keys examined are not emitted by the current production middleware and were not guessed.

The archive now contains 113 records, all within known validation windows; no independent organic-traffic cohort is established. Summary stderr: invalidJson=0, wrongEvent=0, missingFields=0, completeNotTrue=0. Post-start export coverage has no detected gap/exclusion, but the real two-hour and overnight retention checks are still pending elapsed time. Compendium preload cache classifications were 32 hit, 0 miss and 14 unclassified; the resulting 100% classified-hit rate does **not** mean all 46 preload requests were cache hits.

Exact summarizer stdout and stderr are saved in [stdout](../../.local/performance-comparison-20261102/production-summary.stdout.json) and [stderr](../../.local/performance-comparison-20261102/production-summary.stderr.json). The summarizer was used as-is.

## Additional verification and implication

All 33 focused notebook startup/search, Item Workshop concurrency, room-detail parallel-read and API-response tests pass across four files. The recent thread's waterfall changes remain local: player notebook listing/link startup removes one redundant request; room and item reads overlap existing requests; search retains debounce and cancellation. Unit coverage proves those contracts/concurrency, not a measured production wall-clock gain.

The notebook repeat-page improvement is reproducible locally; its first-load navigation and the three SORT exceptions remain. Compendium warm clicks are consistently small in this sample. Production page-start variability, creation-options and equipment lookups deserve the next focused measurement. Fewer metadata requests alone did not guarantee a lower end-to-end median in this run. No application change or deployment was made by this test task.

Sanitized aggregate evidence: [comparison.json](../../.local/performance-comparison-20261102/comparison.json). Raw timing-only run artifacts and preserved earlier evidence are in the same ignored directory; no credentials, titles, entry text or user IDs are included in the new measurement output.

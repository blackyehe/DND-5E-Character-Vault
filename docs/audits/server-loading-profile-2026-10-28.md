# Hosted server loading profile, 28 October 2026

The multi-second delay is now attributed to **reading prepared catalogue data from MongoDB**. Creator component reads take about 8.8 seconds, sheet rule reads about 7.8 seconds, and the first monster component read about 6.8 seconds. Catalogue composition itself takes only tens of milliseconds. These are authenticated hosted observations, not estimates from local performance. No optimization was committed, pushed or promoted by this investigation.

## Diagnostic boundary

The audited live `compendium-components.ts` is byte-identical to the local reader. Production already uses prepared mode. An outdated reader or disabled rollout does not explain the delay.

Isolated diagnostic deployment `dpl_Acaz6dG23P8dEabM2ZCX49KzkTjV`, `https://dndoldal-o7hin444f-dndenjoyerstudio.vercel.app`, was reconstructed from the exact retained public source. Six existing backend files change and two helpers are added. All **372 uploaded hashes** match the intended source. Unrelated local authentication edits, the retained creator cache and the editor split are excluded. It uses production environment values, with domain auto-assignment disabled and no aliases assigned. The public alias remains on `dpl_7FB8zBXowAKfqZt8izXd8SVFTY53`; the earlier promotion hold remains in force.

The diagnostic returns per-request numeric command counts/durations, row counts and coarse stage timings in a response header. It records no filters, documents, account IDs, credentials or raw error messages. Driver durations include response delivery; they do **not** isolate database execution, network transfer and queuing.

The user signed in. Six sequential creator reads alternate original/larger batches, reversing the middle pair's order. A diagnostic header bypasses the application catalogue hit, reproducing its rebuild work without deleting caches or forcing a platform cold start. All six response hashes match the retained local result: 2,696,833 raw bytes. Raw response content is not retained.

## Creator attribution and rejected batch candidate

Three samples per variant:

| Hosted stage, median | Original batch 128 | Larger batch 2,048 |
| --- | ---: | ---: |
| Application response handling | 10,750 ms | 10,699 ms |
| Initial source metadata | 320 ms | 319 ms |
| Prepared manifests | 1,009 ms | 1,008 ms |
| Prepared component cursor | **8,802 ms** | **8,739 ms** |
| Decode/integrity/shape checks | 202 ms | 223 ms |
| Catalogue composition | 19 ms | 14 ms |
| Database commands | 14 | 7 |

The cursor accounts for `8,801.9 / 10,750 = 81.88%` of application time; cursor plus manifests account for approximately **91.26%**. These are separate stage medians, not an exact additive breakdown of one request. Remaining work includes final revision validation, projection and serialization.

The original returns 1,008 component objects through one find and seven continuations; one continuation alone takes about 6.4 seconds. The larger batch puts about 8.7 seconds into the initial find. It preserves ownership, revision validation, byte limits and integrity checks, yet saves only `10,750 - 10,699 = 51 ms`, **0.47%**, with overlapping application ranges: 10,675–10,814 versus 10,690–10,708 ms. **Reject it for the requested multi-second goal.** No corresponding main-checkout change is retained.

Browser completion medians are 12,231 versus 11,074 ms, but body delivery/platform overhead varies. This does not establish a 1.16-second server improvement. Two ordinary public-site warm creator reads separately took 493/566 ms, with 320/318 ms application handling; do not mix them into the catalogue-miss sample.

The local comparison also shows why simulated latency is insufficient:

| Local median, three fresh workers per variant/route | Original | Larger batch |
| --- | ---: | ---: |
| Creator, ordinary loopback | 194 ms | 174 ms |
| References, ordinary loopback | 171 ms | 164 ms |
| Creator, added 250 ms Mongo wire round trip | 4,044 ms | 2,104 ms |
| References, added 250 ms Mongo wire round trip | 4,286 ms | 2,908 ms |

All twelve ordinary response hashes match per route, as do all twelve simulated-network responses. The proxy delays complete wire messages by 125 ms each way. Imports/connection precede timing. Its apparent multi-second benefit was **not reproduced on Vercel**.

## Compendium and references

Two serial rounds used one accessible character and the real library. The cold diagnostic header bypasses creator/character-rule library hits, but leaves Compendium's normal index caches intact.

| Request | Application | Component cursor | Manifests | Decode |
| --- | ---: | ---: | ---: | ---: |
| First monsters | 11,623 ms | **6,796 ms** | 1,012 ms | 78 ms |
| First equipment | 5,476 ms | 1,259 ms | 1,011 ms | 17 ms |
| References, rule-library miss 1 | 10,440 ms | **7,774 ms** | 1,007 ms | 105 ms |
| References, rule-library miss 2 | 10,443 ms | **7,784 ms** | 1,026 ms | 91 ms |
| Second monsters, normal RAM hit | 488 ms | — | — | — |
| Second equipment, normal RAM hit | 246 ms | — | — | — |

Each category miss also spends about **one second on a failed optional stored-index read and one second on a failed persistence operation**, close to their 1,000 ms deadlines. Runtime warnings are still MongoOperationTimeoutError/MongoBulkWriteError; no numeric code is present in the permitted diagnostic fields. This establishes deadline cost, not duplicate indexes, permissions or storage exhaustion. Longer deadlines could simply make misses slower.

Response hashes match within each category/reference pair. No character edits/imports occurred. Normal GET handlers may attempt derived-cache writes, so these reads are not strictly database-read-only operations. References are supplemental loading, not evidence of a blank sheet for the entire interval.

## Atlas evidence

The user separately authenticated Atlas. Read-only inspection confirms **Free/M0, AWS Frankfurt**, matching Vercel's region. The overview shows approximately **157.45 MiB / 512 MiB** logical size and **15 / 500** connections. The inspected one-hour primary series peaks at 29 connections. These do not suggest exhausted storage or connection capacity.

Integrating seven-day hourly Network “bytes out” rates gives:

| Member | Approximate outbound bytes | Decimal GB |
| --- | ---: | ---: |
| 00 | 41,446,292 | 0.041 |
| 01 | 9,400,566,128 | 9.401 |
| 02, current primary | 11,856,141,717 | **11.856** |

Calculation: sum sampled bytes/second multiplied by elapsed sample interval, over 169 hourly samples. These are monitoring-counter estimates, **not Atlas's exact quota meter**. Compression, counter definitions, sampling and node traffic can differ from quota accounting. Do not claim that exactly 21.3 GB of billable traffic exhausted the allowance.

[Atlas Free limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/) specify 10 GB outbound and 10 GB inbound per rolling seven days, with network throttling after transfer-limit exhaustion. Substantial outbound counters and the observed slow large responses make **transfer throttling a strong working explanation**, not a confirmed enforcement flag. Operation Throttling series are null, not affirmative zero measurements. Free-tier CPU/queue/execution metrics are unavailable. Matching regions alone cannot rule out a slow network path.

The identical local capture contains 650,751 compressed payload bytes / 858,021 projected BSON bytes for the eight creator categories, across 1,008 objects; 994 are verified empty category objects. This is fixture accounting, not a hosted packet capture. Empty-record overhead could be reduced with a representation that preserves verified empty-category proofs. Simply trusting counts and omitting validation is not an equivalent optimization.

No Atlas settings, indexes, users, cluster size or billing changed. Chart selection changes only the monitoring view. No upgrade was purchased.

## Decision before further implementation

1. **Keep the accepted creator cache.** Its matching conditional request avoids component/manifest reads. Comparing the measured 10.75-second catalogue miss with approximately 0.32-second metadata validation identifies roughly **10.4 seconds of potentially avoidable server work on an unchanged repeat visit**. This is a calculation, not a hosted cache-candidate measurement. Previous browser results and first-visit/storage costs remain in `loading-times-2026-10-28.md`.
2. **Next local candidate: authenticated, revision-validated Compendium page reuse.** A cold monster index versus RAM hit differs by over ten seconds. Persistent page reuse must validate owner, current sources, implementation version and complete search/filter/page key before use. It principally helps repeat visits, including fresh backend instances; it does not fix uncached browsing/searches. Offline/401 must never silently expose stored pages. No implementation or measured saving is claimed yet.
3. **For first visits, target database delivery and transferred data.** Component reads alone expose a 6.8–8.8-second budget. A 75% reduction, if achieved, would save about **5.1–6.6 seconds** before overlapping work: a target calculation, not a forecast. Smaller prepared initial projections and selected-definition loading require complete draft/character hydration and rule-equivalence checks. Another cache in the same database must prove smaller reads and successful writes.
4. **Verify transfer accounting before buying infrastructure.** Counter evidence merits actual quota accounting/support confirmation or a separately authorized controlled hosting comparison. No paid upgrade or production timeout increase has been made or established as a guaranteed cure.

The retained creator-cache source hashes and all six protected hashes match their starting values. Main-checkout application source is unchanged by this investigation. Exact diagnostic backend TypeScript checking and real-route/hosted equivalence checks pass. The full suite was not rerun for ignored diagnostics/documentation; the previous 479-pass dirty-checkout result remains the latest full-suite run, with its existing authentication caveat.

Ignored `.local/server-latency-20261028/` retains source manifests/audit, temporary profiling source, local/simulated/hosted results, Atlas numeric series, fixture accounting and runtime extracts. The bounded loopback database was dropped after host/name verification; proxy/request workers stopped. The diagnostic remains **unpromoted** for follow-up, with its cold/batch switches confined there.

## Cache-storage follow-up and release decision

Read-only Atlas inspection found the unique `{userId,revision,kind,part}` index and the expiry TTL index present and READY. The collection held 124 documents / approximately 6.55 MB; cluster data was approximately 159 MB. Missing indexes and the 512 MB storage ceiling do not explain the observed failures.

An isolated 377-file diagnostic (`dpl_2Cdgbih4Yfotk1gDCNzXdAw1uZk7`, never promote) restricted a synthetic cache probe to the dedicated validation account. Seeding 3,500 generated records failed even with an 8,000 ms operation allowance: **8,092 ms application / 8,727 ms total**, `MongoBulkWriteError`, with the underlying timeout recognized. Cleanup succeeded in 18 ms application / 376 ms total and found no documents. Because seeding failed, the planned 1,000-vs-4,000 ms read/write comparisons **did not run**. This does not justify increasing production cache deadlines. Evidence: `.local/server-cache-recovery-20261028/probe-results.json`.

Three desktop compression trials per captured index verified lossless round trips. Brotli quality 6 reduced bare monster index bytes from 881,556 to 716,249 (**18.75%**) and magic items from 471,674 to 372,539 (**21.02%**). Desktop median encoding was 56.8/37.8 ms respectively; hosted CPU and database performance were not measured. At the earlier illustrative 3 Mbps transfer rate, these byte differences represent only **0.44 / 0.26 seconds**, excluding server work. These are bare stored indexes, not the larger authenticated export envelopes. Quality 11 cost approximately 7.36/6.73 seconds of desktop encoding and is unsuitable for interactive reconstruction. Evidence: `compression.json` beside the probe results.

No cache format, production timeout, database engine or billing change is retained from this investigation. The local Compendium has already demonstrated the requested multi-second repeat-visit improvement; proceed with its explicit-save rollout and preserve first-save costs as a separate, unresolved server problem. See [the local Compendium audit](local-compendium-2026-10-28.md) for correctness checks and release tradeoffs.

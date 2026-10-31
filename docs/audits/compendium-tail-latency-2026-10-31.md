# Exceptional Compendium waits — 31 October 2026

The user accepts normal one-to-two-second entry opening and requested reproduction and reduction of the occasional much longer waits. Initial investigation and changes were local. The queue fix is now published and publicly verified; [release evidence](srd-queue-release-2026-10-31.md). Original source packs, characters, rooms and unfinished Owlbear authentication are preserved. The changed-pack fallback prototype remains local.

## Current live sampling

Using the authenticated shared browser, 31 imported full-entry reads were made sequentially across first/last pages of classes, subclasses, races, equipment, magic items and monsters. Entries with more duplicate aliases were preferred where available. Requests were separated by a small pause; this was not a concurrent production load test. They completed in 82–1,065 ms, median 340 ms, with no errors. This window did not reproduce the reported exceptional waits and did not force production cold starts or clear live caches.

The largest reported application processing duration was 93.1 ms. `Server-Timing` measures from Express middleware; it excludes earlier platform/function initialization and network/proxy time. Its `db` field measures connection readiness, not all database queries. The browser/application difference therefore cannot be attributed entirely to the database or entirely to the user's network.

## Imported data: one invalid prepared pack can trigger a full-library rebuild

The verified 126-pack snapshot was replayed in a uniquely named loopback-only database. All category component catalogues were prepared. Large unique-source entries came from a 3.7 MiB pack for classes and a 14.9 MiB pack for items/monsters. Each measured request ran in a fresh Node process, with original pack and entry data retained. No production database access or secrets were used.

With no artificial database delay, a first entry-source miss took 311–753 ms and a persistent source-cache hit in another fresh process took 19–24 ms. Those local results alone do not explain a long hosted stall.

A separate loopback Mongo wire relay then delayed each complete database reply by 150 ms, retaining concurrent operations. This is explicitly an injected delay, not a measurement of the production cluster. With valid category indexes but missing full prepared sources, first reads took 4.88–4.90 seconds. Preparing the corresponding full sources reduced these reads to 2.82–3.01 seconds, with identical complete-response hashes. Persistent source-cache hits remained around 1.1–1.3 seconds under the same delay.

For the more severe case, one large fixture pack's revision timestamp was changed while its source bytes stayed unchanged. This simulates invalidated preparation without introducing any rule change, allowing exact output comparison. Both measured cold variants started with no category index for the current revision:

| Scenario, with 150 ms injected per database reply | Cold entry read | Database commands |
| --- | ---: | ---: |
| Changed large pack has no current prepared component | 27.881 s | 358 |
| Changed pack prepared first; category index still cold | 4.316 s | 27 |

The complete response hashes match. A persistent source-cache hit afterward takes about 1.1 seconds. Preparing the changed pack itself took 878 ms on the local database; that is not a hosted preparation-time estimate.

The trace follows the existing code: the current category index misses; the prepared reader finds one invalid component; bounded inline repair rejects a source above its one-MiB eligibility limit; the reader then calls the full Workshop library builder, which reads and parses all packs. The limit protects request resources and must not simply be raised. This proves a mechanism capable of large stalls following pack revisions. It does not prove that a pack revision caused the user's earlier incidents.

The primary follow-up is preparation of changed packs outside foreground entry reads, using the existing verified component machinery. A safe implementation must coalesce work by owner/pack/fingerprint, track completion across serverless requests, verify the current revision before publication, and bound storage with safe cleanup of superseded generations. Reuse parsed import data where possible. Prepare category indexes from current components once rather than allowing each cold category to rebuild the entire library. Failures must leave authoritative source data intact and preserve the existing availability fallback. This automatic lifecycle is **not implemented** by this investigation; only the existing preparation operation was exercised in the isolated fixture.

## Standard rules: queued background work delays interactive requests

`readSrdRule` previously reserved all future 40 ms request slots immediately. A large background queue therefore reserved seconds ahead of a newly opened class/rule. The interactive fetch timeout started after the queue wait, allowing a supposedly four-second lookup to wait substantially longer before fetching anything.

An isolated reader fixture queued 250 distinct background lookups and opened one interactive rule five milliseconds later. Network replies were synthetic and immediate. The exact baseline took 9,984 ms to dispatch/complete the interactive lookup, in position 251. The local candidate took 36 ms, in position 2. Both returned the same response hash and made 251 requests. The whole batch retained its approximately 10-second scheduled duration. This is a deliberately heavy queue condition; it is not proof that normal limited-use imports generate 250 concurrent requests.

The local fix dispatches interactive requests before queued background work, retains one shared 40 ms target cadence, gives background work a slot after eight consecutive interactive starts, and includes queue waiting and response-body reading in the interactive lookup's four-second deadline. Cache coalescing, missing-rule handling, rate-limit handling and background retry limits remain covered. The deadline applies to this upstream lookup, not to preceding authorization/database work in the entire HTTP request.

An initial scheduler draft accumulated Windows timer lateness and slowed the synthetic bulk batch. It was corrected to advance the scheduled cadence. The final serial replay retains background completion at about 10.002 seconds versus 10.001 seconds for the baseline; a deterministic lateness test guards against reintroducing drift.

Code is retained in `server/lib/srd-client.ts`, `server/lib/srd-request-queue.ts` and `server/lib/srd-client.test.ts`, both in the original checkout and isolated verified website worktree. The original unfinished authentication edits were preserved. Validation covers priority, shared pacing, background fairness, queue expiration, cache coalescing, body deadlines, retry behavior and timer drift. The queue change is now live; the larger rebuild remedy is not yet published.

The queue release's website suite passes 662 tests with 48 existing skips; backend type checking passes. Seven dedicated queue/deadline tests pass. Both working copies contain identical queue changes. Work on the changed-pack rebuild path follows separately, with the safeguards described above. A bounded, read-only fallback is being evaluated to avoid rebuilding unchanged packs without creating automatic stored generations.

## Evidence and cleanup

Ignored evidence is under `.local/compendium-tail-latency-20261031/`: frozen control/candidate runtime, live timing summaries, serial queue comparisons, cold-reader traces, injected-latency relay, full-source preparation comparisons, exact response hashes, test/type reports and interactive chart. Source text, credentials and image bytes are not included in this report. The isolated `tail_latency_20261031_…` database was dropped after host/database assertions; `cleanup.json` records completion. The real library and its live caches were not cleared or changed by the test harness.

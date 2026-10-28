# Device Compendium prototype — 28 October 2026

Status: implemented and measured locally and on an isolated hosted diagnostic, uncommitted application candidate, disabled unless `VITE_LOCAL_COMPENDIUM=true`. No production configuration or database engine changed. The separate creator-cache/deferred-sheet release is live; see [its release audit](cache-release-2026-10-28.md).

## Scope and eligibility

The prototype offers an explicit **Save category on this device** action. Normal unsaved browsing keeps the paginated server route and does not download the worker. A small localStorage hint avoids worker startup for unsaved categories; it cannot authorize cached data. The authenticated export contains existing compact search/facet/family metadata, not full entry definitions. Full details continue to load on demand through the existing authorized route.

IndexedDB holds at most 24 MiB of payloads, at most 8 MiB/30,000 records per category, for one account. Saving another account's category removes prior-owner records. Snapshots carry a transport/query version, exact owner/category/revision, SHA-256 of the exact JSON payload and a seven-day storage eligibility limit. The worker validates the checksum and structure before parsing/admitting the index. It retains one parsed category in memory. IndexedDB operations have a two-second bound; failed workers/storage use server browsing.

Before local results are used, a small authenticated metadata request must confirm the exact current revision. Successful validation is eligible for 30 seconds, matching the existing page cache's window. Remote edits/removals can therefore remain visible for up to that window; this is not immediate cross-device synchronization or a promise of offline access. Local edits/import transitions and Retry invalidate validation. Account changes/logout clear the device scope, terminate pending worker operations and prevent late old-account results from being admitted. Storage events invalidate parsed indexes in other tabs when the device scope changes. The UI also offers removal of all saved categories.

A previously saved worker/index is prepared alongside the ordinary initial Compendium page, without speculative API/database calls. This overlaps worker startup with normal browsing. Preparation alone never authorizes results. Initial synchronization still requires the server and may be slow. A changed server revision falls back to ordinary browsing; the user must explicitly save the updated category again. Automatic/background refresh, offline editing, session bundles and character writes are outside this stage.

## Transfer calculations before rollout

The 126-pack replay plus repository SRD metadata produced these actual compressed export sizes. The transfer calculation is compressed bytes / 375,000 bytes per second (3 Mbps), excluding latency, server work, parsing and storage.

| Category | Source entries | Device payload | Compressed export | Transfer alone at 3 Mbps | Existing first page, gzip |
| --- | ---: | ---: | ---: | ---: | ---: |
| Monsters | 5,956 | 5,493,120 B | 901,673 B | 2.40 s | 8,879 B |
| Magic items | 5,801 | 4,747,879 B | 482,582 B | 1.29 s | 5,237 B |
| Equipment | 1,402 | 926,432 B | 102,022 B | 0.27 s | 3,614 B |
| Spells | 635 | 349,748 B | 37,313 B | 0.10 s | 2,273 B |

The earlier estimate of 882 KB/2.33 s referred to the bare monster index, before the exact JSON/checksum transport envelope; the actual export above is the rollout calculation. The worker is 119,099 uncompressed JavaScript bytes, fetched only after saving or on a visit with a saved hint. The server compresses the export itself and rejects compressed bodies above 2 MiB; large plain indexes do not become buffered oversized platform responses. The isolated hosted monster export subsequently confirmed the same 901,673 compressed bytes and passed real browser decompression, checksum, storage and query checks.

## Measured results

Three fresh browser contexts per profile used the actual production UI build, real worker/IndexedDB, real authenticated routes and a disposable loopback MongoDB containing the captured 126 packs and prepared components. Server/OS caches were warm. The constrained profile used CDP 150 ms latency, 3 Mbps download, 1 Mbps upload and 4× main-page CPU throttling; worker CPU throttling is not independently established. Static hashed assets had immutable caching. Category timing runs from the selection click to rendered rows. Sync timing includes the explicit click, download, verification, disk write and revision check. Search includes the existing 250 ms debounce.

| Median | Loopback | Constrained |
| --- | ---: | ---: |
| Unsaved warm server category | 228 ms | 399 ms |
| Saved category after full document revisit | 229 ms | 420 ms |
| Explicit first monster synchronization | 327 ms | 3,479 ms |
| Saved search, including debounce | 263 ms | 300 ms |

Without preparing the saved worker alongside the initial page, the constrained revisit median was 935 ms; preparation reduced it to 420 ms. Against the already-fast warm server, this is roughly neutral (21 ms slower in this small constrained sample), not a demonstrated multi-second gain. Pure monster worker queries had a 4.5 ms median in the unthrottled equivalence run.

The earlier hosted category miss was 11,623 ms versus a 488 ms RAM hit, leaving an 11,135 ms opportunity budget. Those local measurements demonstrated that the query/index path can be cheap; they did not establish hosted saved-category readiness. Subsequent [conditional-request diagnostics](conditional-cache-2026-10-28.md) corrected the earlier attribution of the creator's 11-second 304 to metadata: the standard conditional header was absent at the application boundary, permitting a full catalogue load. The separate Compendium revision endpoint was then measured directly.

### Isolated hosted measurements

On the corrected 383-file diagnostic, the actual unsaved monster UI took **12,121 ms** from category selection to rendered rows. Saved-category selection after three full document revisits took **379, 646 and 377 ms** (median **379 ms**), each using one authenticated metadata revision check and no category/definition read. The observed cold-to-saved saving is **11,742 ms, or 96.9%**. Warm server visits can already be fast; this is the gain from avoiding cold reconstruction, not a promise that every visit improves by 11 seconds.

Explicit monster saving took **5,356 ms** after the normal category had warmed the server, transferring 901,673 compressed bytes. A subsequent saved search took **258 ms** including debounce, with no additional request during its validation window. Five further hosted worker/server comparisons matched complete monster page JSON, including pagination, a missing search and a facet filter. These hosted checks supplement the 172-query local equivalence run. Evidence is in `.local/conditional-profile-20261028-r2/compendium-hosted.json`.

The full optional local attempt now has a **1,500 ms** bound before ordinary browsing, rather than accumulating separate worker, disk and network timeouts. A timeout aborts validation, terminates the stalled worker and skips local attempts for 30 seconds. A cancelled search releases its caller promptly. Real production-UI fixture checks cover a silent worker and a stalled revision request; both preserve server results and avoid another local timeout on subsequent searches. This exceptional path can still add up to 1.5 seconds before server browsing on a responsive browser.

Six alternating hosted full-document visits also compared the initial spell page with the saved monster hint temporarily present or absent. With preparation the initial-page median was 1,239 ms, versus 1,211 ms without it (**28 ms difference**); individual samples varied widely (473–1,734 ms overall). Only the ordinary spell page was requested; preparation made no speculative revision/index request. This small warm-browser sample establishes no substantial contention regression, but cannot establish behavior under mobile memory pressure. The saved marker was restored after measurement; evidence is `initial-page-contention.json` alongside the hosted results.

## Verification and remaining risks

The actual built worker matched the server's complete page JSON for **172 queries across all 15 categories**, including empty/missing searches, page clamping/family grouping, category/common facets and item filters. UI checks covered explicit saving, zero-request search after validation, worker recreation/IndexedDB reopening and corrupt-disk fallback. Separate browser checks covered blocked storage, failed worker download, changed/unauthorized revision checks, account changes and removal. A mobile screenshot was inspected at 390 px with no horizontal overflow.

An actual IndexedDB budget check saved four padded seven-MiB categories, retained three (22,023,888 bytes), evicted the oldest category, then saved another owner's category and verified that only its one record remained. Unit tests cover malformed/corrupt/oversized/expired snapshots, quota failure, exact query identity, offline/unauthorized/wrong-owner/wrong-version validation, in-flight account changes, invalidation from another tab and a worker constructor blocked by policy. Frontend/backend TypeScript checks pass; the working checkout passes **504 tests with 55 opt-in skips**. That checkout still contains unrelated unfinished extension edits; it is not the frozen live release.

Remaining work before any live enablement: review the measured first-download and fallback costs; test storage eviction/quota under real browser pressure; and decide how updated categories should be synchronized without making every initial visit expensive. The current working suite passes **513 tests with 55 opt-in skips**; the isolated hosted source separately passes both TypeScript checks, its build and 55 focused tests. Browser data remains evictable and device-specific; server originals remain the recovery path. MySQL remains a separate workload/hosting comparison, with no migration justified or performed by this prototype.

Ignored `.local/local-compendium-20261028/` preserves the fixture tools, source hashes/candidate copy, sizes, before-preparation timings, final timings, 172-query equivalence results, failure and storage-budget checks, and the mobile screenshot. The uniquely named loopback fixture is removed after verification; its state file is evidence, not a guarantee that the database exists.

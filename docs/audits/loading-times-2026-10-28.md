# Loading-time investigation, 28 October 2026

Follow-up: [hosted stage profiling](server-loading-profile-2026-10-28.md) now attributes most catalogue-miss time to MongoDB component delivery, rejects the larger-batch candidate on hosted evidence, and records read-only Atlas metrics. That follow-up creates a separate unpromoted diagnostic deployment; the no-deployment statements below describe the earlier measurement/cache phases.

The previously reviewed sheet download improvement was committed and pushed as `943bc89694111b919b93d5d099e88ed361ca70ed` to `origin/codex/folio-sheet-rollout`. The remote SHA was verified. This is a branch push, not a live promotion. The four unrelated local extension authentication files retain their starting hashes.

The initial assessment below compared existing readers and calculated possible changes before implementation. Following authorization to investigate caching, a **local, uncommitted creator-cache candidate** was implemented and measured; its results and costs appear in the final section. No further commit, push, deployment or hosted configuration change has been made. Existing preview promotion remains held.

## What the live website is waiting for

An authenticated browser tab on the current production website made five rounds of GET requests. Creator rounds reproduce its six parallel bootstrap requests. Sheet quick and reference requests are measured separately and sequentially. Three additional Compendium categories were read five times each. No character, account or authored-content edits were made. Normal GET handlers may refresh their derived server caches.

| API path / group | Slow observations | Later faster observations |
| --- | ---: | ---: |
| Creator bootstrap, six parallel requests | 11.415, 11.997, 14.464 s | 0.558, 0.572 s |
| Sheet references | 10.511, 10.649, 10.704 s | 0.830, 0.903 s |
| Compendium monster page | First read 11.853 s | 0.401–0.642 s |
| Compendium equipment page | First read 4.568 s | 0.296–0.350 s |
| Compendium class page | First read 0.604 s | 0.284–0.309 s |
| Compendium spell page | 0.322–1.007 s across five rounds | No separate slow/fast classification |
| Saved quick sheet | 0.823–1.043 s across five rounds | Median 0.845 s |

The creator's imported-options response is **2,696,833 raw bytes**, with **418,042 encoded body bytes** reported by the browser. Sheet references are 106,413 raw / 19,226 encoded bytes. In the first slow reference read, time to first response byte was 10.700 s and response text consumption took only 2 ms. The first slow creator read spent 13.381 s before its first response byte and approximately 1.054 s consuming its body. Large server waits are the main target; shaving a few kilobytes of JavaScript cannot remove them.

Server-Timing also attributes substantial time to application handling: approximately 11.14–11.22 s for the three slow creator responses and 11.796 s for the first monster page. Its `db` metric measures database connection readiness, **not all database query time**. These headers do not identify a particular query, reader flag, fallback or serverless instance.

These observations are API timings, not end-to-end navigation or web-vitals measurements. The sheet shows saved information before references finish. Slower reference loading is not equivalent to a blank sheet for that entire period. The two fast creator rounds must not be discarded or presented as slow. No cold instance was forced. The observations alone did not establish instance identity, active production reader settings or fallback reasons; the follow-up below establishes the reader configuration and some storage failures.

The initial page's authentication request took 2.572 s; subsequent explicit authentication reads took 0.064–0.136 s. Initial route authentication remains another variable. No authentication behavior was changed.

## Controlled local comparison: existing legacy and prepared readers

The retained digest-verified 126-pack capture was replayed into a newly named database on `127.0.0.1`. Existing component preparation ran only there. Both readers use the current checkout's existing website handlers; this is **not a new implementation** or a claim that production currently uses the legacy reader.

Three fresh Node workers per reader and route each made one cold-library request and five subsequent warm requests. Reader order alternated across repetitions. The database connection and application module import completed before timing; filesystem caches were not flushed. For monster browsing, only this disposable owner's derived browse indexes were cleared before each worker's cold request, giving both readers the same index-miss condition. Prepared components already existed for both modes. No concurrent build or test workload ran.

| Route | Legacy cold median | Prepared cold median | Local saving | Reduction | MongoDB commands |
| --- | ---: | ---: | ---: | ---: | ---: |
| Creator options | 4,097.57 ms | 172.61 ms | 3,924.95 ms | 95.79% | 313 → 14 |
| Sheet references | 4,150.12 ms | 167.23 ms | 3,982.89 ms | 95.97% | 310 → 15 |
| Monster browse page | 5,455.81 ms | 348.03 ms | 5,107.78 ms | 93.62% | 316 → 15 |

Formula: `(legacy median - prepared median) / legacy median × 100`.

Cold ranges were 4,057.95–4,271.71 / 169.71–175.68 ms for creator options; 4,087.72–4,240.78 / 155.25–170.88 ms for references; and 5,453.36–5,536.04 / 344.73–377.19 ms for monster browsing. Warm median legacy/prepared times were 26.05/19.85, 6.38/5.21 and 78.73/64.47 ms respectively. The principal opportunity is the first library/index read, rather than a large warm-path gain.

All **108 local API responses** succeeded. Each worker's warm responses matched its cold response hash, and all cold hashes matched across legacy/prepared workers for each route. This verifies the captured outputs, not every possible account, revision race, malformed component or character rule combination. The sheet fixture is fictional; the imported content is the retained captured library. Local requests exclude hosted network latency and Vercel startup. These percentages must not be advertised as production-page improvements.

The temporary database was removed after measurement, with its name and loopback host checked before removal. No hosted database was connected by the local harness.

## Creator download calculation

The existing bootstrap eagerly returns 1,336 imported definitions, including every subclass, feat and spell. A calculation-only projection retains `index`, `name`, `displayName`, `url`, `sourcePack`, `contentKey`, `aliases`, `class`, `race` and `level` wherever present. It is not yet a proven sufficient schema for the creator; details currently used for rules and choices would need a reliable on-demand loader.

Compressing both complete and projected JSON with the same browser gzip implementation gives:

| Payload | Raw bytes | gzip bytes |
| --- | ---: | ---: |
| Existing complete response | 2,696,833 | 427,194 |
| Illustrative metadata-only response | 410,671 | 62,633 |
| Difference | 2,286,162 | 364,561 |

Compressed reduction: `364,561 / 427,194 = 85.34%`. At the previous controlled download rate of 200,000 bytes/s (1.6 Mbit/s), transfer-only saving is `364,561 / 200,000 = 1.823 s`. At 10 Mbit/s it is approximately 0.292 s. Hosted encoding differed slightly, so this is an internally consistent gzip calculation, not a claim about exact Vercel wire savings.

Keeping full classes/races/backgrounds/languages but deferring subclasses/subraces/feats/spells produces 632,881 raw / 98,689 gzip bytes, a 76.90% compressed reduction and 1.643 s transfer-only saving at 1.6 Mbit/s. Restored drafts, subclass choices, feats and selected spell aliases may require those deferred groups immediately, so this is an alternative size calculation rather than a completed behavior design.

Reducing the response after building the entire catalogue would **not** remove the measured server rebuild delay. A useful implementation must also avoid assembling unnecessary definitions on the initial request.

Tradeoffs: additional selection-time requests, loading/error states and restored-draft hydration; careful revision consistency and alias handling; possible extra total traffic if every definition is eventually visited. Rule data cannot simply be removed without replacement.

## JavaScript priorities

The pushed production build's static route closures, including the shared entry, contain 179,329 gzip JS bytes for Compendium, 130,370 for creation and 119,629 for sheets. These are local gzip measurements, not production wire sizes. Dynamic tools are excluded until requested; CSS is separate.

Compendium eagerly imports its editor, which brings Workshop, monster-authoring and item-creation code into browsing. Four related chunks total 270,104 raw / 64,905 gzip JS bytes, with 9,188 gzip CSS bytes. Some filter/reader code in these chunks is required during browsing. Therefore 74,093 compressed bytes, or 0.370 s of transfer at 1.6 Mbit/s, is a **candidate ceiling for those chunks**, not a promised removable amount. Actual chunk restructuring could change these numbers and add first-editor delay. A controlled candidate build is required before claiming savings. This is a secondary opportunity beside the multi-second server waits.

## Recommended order and decision checkpoint

1. **Investigate the live slow server path first.** Establish the active reader and whether slow requests rebuild full sources, miss prepared components, fall back, or spend time elsewhere. The controlled results justify this as the highest-value direction. Existing prepared readers already provide a useful alternative; do not duplicate them or change a rollout flag without establishing the cause. Preserve owner boundaries, exact revision validation and current failure behavior.
2. **Reduce creator bootstrap work and data.** After server-path evidence, design metadata lists plus selected definitions, or staged catalogues with complete draft hydration. The measured size calculation establishes an approximately 1.8 s transfer opportunity on the earlier slow-network profile, independent of any server gain. Verify rules and restored drafts before committing an implementation.
3. **Defer Compendium authoring code from browsing.** Measure the actual build delta and first-editor cost before retaining it.

Do not add these local savings to the live slow/fast differences or to each other as a guaranteed page speedup. The paths have overlapping work, caching and network costs. At this initial assessment checkpoint, no next optimization had been implemented, committed or deployed. The subsequent local candidate is documented below.

Raw measurements and reproducible scripts are retained in ignored `.local/loading-analysis-20261028/`: `hosted.json`, `browse-hosted.json`, `payload.json`, `assets.json`, `backend.json`, `backend-browse.json`, `summary.json`, `backend.ts`, `assets.mjs` and `summarize.mjs`. Only aggregate timings, sizes, counts and hashes are recorded in the new evidence; no full hosted character or creator response was saved by this investigation.

The previously reviewed sheet change retains its documented validation and known inherited clean-snapshot server test/typecheck limitations. This investigation did not modify those unrelated files to make the committed snapshot appear green.

## Follow-up: production evidence and local creator-cache candidate

### What was established

Read-only inspection of the Vercel project confirmed production has `COMPENDIUM_READER=prepared` and `COMPENDIUM_PREPARED_USERS=*`. Enabling that reader is therefore not a new production optimization. No environment values were changed.

Runtime logs corresponding to the earlier measurements record creator catalogue assembly at 10,919, 10,950 and 10,930 ms for 126 packs and 2,696,833 response bytes. They also record `Experimental category cache unavailable` with `MongoOperationTimeoutError` for monsters, and `Prepared index persistence unavailable` with `MongoBulkWriteError` for monsters and equipment. These confirm storage failures, but do **not** establish their exact cause or which assembly stage accounts for the creator delay. Do not attribute them to a particular index, quota or permission without further evidence.

A read-only database diagnostic could not authenticate because the existing Vercel environment reader cannot reveal the sensitive password. It made no hosted database changes. Credentials were not retried. This leaves the Compendium persistence diagnosis incomplete.

### Implemented locally

The candidate stores the complete imported creator definitions in IndexedDB, scoped to one owner. On a later visit it verifies the stored shape, size, checksum and expiry, then asks the authenticated server whether that owner's source metadata and implementation version still match. Only an exact ETag match produces a 304 and permits reuse. Changed sources return the complete current response. Authentication and `private, no-store` HTTP headers remain in force.

The matching conditional server path reads current metadata without assembling definitions. No additional MongoDB persistent cache is introduced. The five standard-rules bootstrap requests are unchanged. This pilot applies to **character creation**, not Compendium browsing or sheet reference loading.

Optional disk writes and their checksum calculation run after returning the first usable response. An IndexedDB read has a 100 ms deadline; writes have a 500 ms deadline and do not block readiness. Missing, blocked, expired, corrupted or oversized storage falls back to a full authenticated request. Offline/401 responses do not silently expose stored definitions. Retry library forces a full request. Login, registration, logout and detected account transitions invalidate the cache scope; epoch checks also reject old in-flight responses and cancel old scheduled writes. Initial authenticated document loading preserves the persisted copy so repeat visits can benefit, while the owner and server revision checks still apply.

### Measured server work

Five alternating pairs used fresh Node processes, an already connected disposable loopback MongoDB and the same prepared 126-pack capture. Application imports and fixture preparation are outside timing. All full-response hashes matched. The conditional responses were authenticated 304s with no body.

| Creator request | Median | Range | Mongo commands | Raw response body |
| --- | ---: | ---: | ---: | ---: |
| Complete 200, cold application catalogue | 171.08 ms | 166.11–187.27 ms | 14 | 2,696,833 bytes |
| Validated 304, no application catalogue | 44.86 ms | 44.13–47.69 ms | 2 | 0 bytes |

Reduction: `(171.0774 - 44.8554) / 171.0774 = 73.78%`, or 126.22 ms locally. This is not a measurement of Vercel startup, hosted database latency, or elimination of the observed 10.9-second production assembly time. Authentication, connection readiness and metadata reads are still required.

### Measured browser loading

Headless Edge 155.0.4283.62 compared the exact previously pushed frontend build with the candidate production build. Five pairs per network profile alternated build order, using isolated contexts. Each context made an empty-cache first document visit and a second document visit preserving IndexedDB. The application catalogue and database were warmed before measurement; API and static responses used gzip and `no-store`, so HTTP asset caching did not influence the comparison. CPU was not throttled.

The constrained profile used 80 ms latency, 200,000 bytes/s download (1.6 Mbit/s) and 100,000 bytes/s upload. Both builds used the real catalogue/auth routes and disposable database. Four standard-rule bootstrap lists used fixed repository index fixtures because the separate local SRD service was unavailable. Equipment used the real local-snapshot handler. Readiness means the creator choices fieldset was rendered, not every later selection detail or production web vital. All 40 measured navigations had the same race-option count, no library warnings and no captured page errors.

| Profile and visit | Before median | Candidate median | Difference |
| --- | ---: | ---: | ---: |
| Constrained, repeat | 3,600.0 ms | 1,442.7 ms | 2,157.3 ms faster (59.93%) |
| Constrained, first | 3,625.3 ms | 3,629.4 ms | 4.1 ms slower (effectively unchanged in this sample) |
| Loopback, repeat | 146.2 ms | 105.3 ms | 40.9 ms faster (27.98%) |
| Loopback, first | 166.5 ms | 191.3 ms | 24.8 ms slower (14.89%) |

Constrained repeat ranges were 3,576.4–3,607.8 ms before and 1,428.4–1,449.7 ms after. Loopback first-visit ranges were 152.6–187.3 ms before and 180.3–230.7 ms after. The uncached local regression must not be hidden; this cache is a repeat-visit optimization, not a first-visit improvement. These are controlled local measurements, not guaranteed production results or phone CPU measurements.

An unchanged repeat visit avoids **427,194 gzip body bytes** (2,696,833 raw). Transfer-only calculation: `427,194 / 200,000 = 2.136 s` at the constrained download rate, before headers and request latency. The measured 2.157-second creator readiness improvement already includes overlapping work; do not add it to the server reduction or the transfer calculation.

### Costs and behavior checks

The initial shared JavaScript closure grows from 71,410 to 72,431 gzip bytes: **+1,021 bytes** (+2,641 raw). The creator closure grows by 1,034 gzip bytes, sheet closure by 1,022 and Compendium closure by 1,017, because authentication imports the cache invalidation helper. These are local build gzip sizes, not hosted wire measurements. First visits still download and assemble the complete catalogue. Changed revisions incur an additional metadata check before the full response. Browser checksum/structured-clone work consumes CPU and memory; slower devices may pay more than the desktop measurements.

Storage retains at most one account's serialized definitions, eligible for reuse for 24 hours and bounded to 8 MiB of definition JSON. The measured copy is about 2.70 MB raw, plus record overhead. Expiry prevents reuse; it is not a background disk-deletion timer. Old bytes may remain until replacement, explicit authentication clearing or browser storage removal. Imported content is now retained across document loads. No passwords, tokens or saved character sheets are added to this cache. This is a material storage/privacy tradeoff, even with account and revision checks.

Browser integration checks passed for first-response checksum/persistence, actual 304 reuse, expired-cache full refresh, identical restored race/subrace/class/subclass/feat/spell selections and review content, forced Retry library, offline and 401 validation failures, a real local pack-set revision, two separate local accounts, actual logout clearing, unauthenticated route rejection despite a valid old ETag, and deliberately blocked IndexedDB. The source-revision browser fixture adds an empty valid pack: it proves invalidation, while changed-definition replacement is covered by server/client unit tests. Offline saved selections can retain an existing detail-error alert after retry; the imported-library warning clears and selections restore. No cache change to that pre-existing retry/detail-alert behavior is included.

The full working-checkout suite passes **476 tests**, with 55 skipped; frontend typecheck, server typecheck and production build pass. New tests include corruption/expiry, storage failures, account isolation, no offline fallback, old in-flight response rejection, nonblocking writes and scheduled-write cancellation at logout. These results include the unrelated pre-existing dirty extension files; they do not resolve the previously documented clean-snapshot server limitations.

### Recommendation and remaining work

The user approved retaining this local creator-cache candidate: the measured repeat-visit gain is substantial on the constrained profile, while the first-load and storage costs are explicit. Its eight application/test source hashes remain unchanged during the next investigation. No commit or deployment has been made. A deployment still needs the existing preview/promotion issues resolved and a hosted authenticated cache check before claiming live improvements. The subsequent Compendium candidate and database-cache investigation are recorded in `compendium-loading-2026-10-28.md`.

For Compendium and sheets, the next high-value work remains diagnosing the **actual failing persistent-cache operations**, including the error codes and failing operation, and accounting for the slow component-read/assembly stages. Repeating the existing prepared-reader rollout or stacking another database cache over unexplained write failures would not be justified by the present evidence. First-visit creator staging remains a separate opportunity requiring selected-definition hydration and rule-equivalence checks.

Evidence and local harnesses are retained under ignored `.local/catalogue-cache-20261028/`: `conditional-bench.json`, `browser-bench.json`, `browser-verification.json`, `summary.json`, runtime-log extracts, validation logs, `conditional-bench.ts`, `serve.ts`, `browser-bench.mjs`, `browser-verify.mjs` and `summarize.mjs`. The earlier browser run with an unavailable SRD fixture is retained separately as `browser-bench-unavailable-srd.json` and excluded from the reported comparison. The disposable database is removed after verification; the fixture scripts verify its loopback host and explicitly bounded database name before dropping it.

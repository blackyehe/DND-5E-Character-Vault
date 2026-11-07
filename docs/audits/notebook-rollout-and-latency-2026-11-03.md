# Notebook rollout and post-fix latency verification

The guarded Notebook reader is live for the existing campaign containing all 92 saved entries. Deployment `dpl_E391jrT92GzvU6H7Vqdm5vV7jV1A` was promoted to https://dndoldal.vercel.app at 18:09 UTC on 3 November 2026. Immutable URL: https://dndoldal-62r8mzzkz-dndenjoyerstudio.vercel.app.

The independent latency verification reproduced long full-page openings. The new reader does not establish that every startup wait is eliminated. Slow cached-asset delivery and connection setup remain an open finding; the complete site audit has not started.

## Rollout and data preservation

The release was reconstructed from the previously verified startup deployment `dpl_E2wknEHLtZjUMSZKeSZAPrgV6nvE`, preserving its production `autoCreate:false`/`autoIndex:false` connection fix, maps, Workshop, Creator and Compendium behavior. The dirty root checkout was not deployed wholesale.

The server-first package retained the existing client and introduced compatible Notebook writers with the indexed reader explicitly off. That deployment, `dpl_E2ip2awvreuounCuJcxViuPYgj7a`, passed hosted authoring and matched response checks and was promoted before migration. The first staged build failed because the package retained the old client API while including a new API test; its client/test boundary was corrected before publication. No failed build was promoted.

The existing privately supplied audit account was checked and initially had no update/index privileges. The user granted `readWrite` on the application database; a subsequent privilege inspection confirmed the required access without printing credentials. No website account/password was changed.

A read-only snapshot session captured the affected rooms, Notebook records, revision history and existing index definitions at a consistent point. Snapshot-session reads share a snapshot across reads, including reads of different collections. [MongoDB specification](https://specifications.readthedocs.io/en/latest/sessions/snapshot-sessions/). Limited character identity/name metadata was captured in the same session only to reproduce authorization/query-plan scopes. No passwords were included. The fresh pre-migration snapshot contained three rooms (including the temporary canary), 122 Notebook records and 307 revisions, about 1.46 MB compressed. Private backups remain in the ignored local evidence directory.

The isolated restore rehearsal proved exact restoration of source data/index definitions, preserved source fields/history through backfill, idempotent reapplication, and 24 valid DM/player query plans without blocking SORT. It also exercised transactions with and without the extra indexes. These timings are local rehearsal results, not predictions of Atlas write costs. Temporary databases were dropped and MongoDB processes stopped.

After the compatible public writer had settled for more than a minute, a fresh backup was verified before production changes. The five approved additive Hungarian-collation indexes were built sequentially; each completed in approximately 74–94 ms in this production observation. Original indexes were retained. The selected room's readiness was invalidated, derived metadata was populated in batches of ten with pauses, and a fresh whole-room consistency check certified it. All 92 entries were prepared. Exact before/after hashes confirmed that source fields (including prose, revisions and timestamps) and revision history were unchanged. Only derived listing metadata and the readiness marker were changed by the migration.

The production preflight and final postflight each passed all 24 DM/player plans, exact index/collation checks, zero inconsistent/unprepared entries and unchanged room scope. The reader stayed off on the public alias until staged indexed-reader validation passed.

## Correctness and release checks

- The new metadata records the source revision. A stale visible record written by an older writer makes the reader fall back instead of trusting old categories/sessions/tags. Legacy fallback uses a stable, permission-scoped source fingerprint when necessary so the client can refresh navigation. A temporary canary exercised a simulated older visible-entry edit and its history, verified fallback, and verified that an ordinary new-writer edit restored indexed reads. This defense does not replace the requirement to keep traffic on compatible writers; arbitrary out-of-band writes remain unsupported.
- Four-mode hosted checks covered initial/default/slim/navigation equivalence for DM/player; hidden entries; creation/edit/tagging; trash/recovery; text restoration and complete history. Existing imported/native pack publication, revision invalidation and exact exports also passed.
- All temporary packs and canary notes/history/rooms were cleaned. The first test harness attempted a room-delete endpoint the site does not have. Cleanup was corrected to a transaction restricted by fixture IDs and ownership; the leftover synthetic records were recovered, and the complete hosted check then passed. Real campaign records were not cleanup targets.
- The final full package has 475 source files. Its hosted manifest audit matched exactly. The server-first package has 474 files because new client-only tests were excluded along with the new client. Selected package tests passed 241 tests with two optional skips; backend TypeScript and frontend production build passed.
- The final ordinary root suite passed 970 tests across 130 files, with 67 optional skips. Public alias, backup checksum, source manifest, fixture cleanup, live browser/API checks and final database readiness were collected into a passing final-gates record.
- Actual built-browser fixtures passed DM/player startup, preview preservation and deferred sheet loading. Real staged and public browsers confirmed indexed initial rendering, slim category requests reusing verified navigation, read-only player preview, no hidden sheet requests, no page errors and no source writes.
- Six real authenticated response pairs matched the previous release exactly, both before promotion and on the public alias. The additive initial response reconstructed the legacy full response exactly. The `X-Notebook-Reader` response header distinguishes actual indexed reads from fallback.

The explicit room allowlist includes the populated campaign and the now-deleted temporary canary ID. Other/unready rooms retain the legacy reader. New rooms receive writer-ready metadata but still require allowlisting before indexed reads. Thus all currently saved campaign entries are prepared, without enabling an unreviewed global wildcard. Deployment overrides do not change project-wide defaults: subsequent releases must deliberately carry the listing flag and selected room allowlist.

## Positive indicator and latency limits

Six matched category pairs returned identical Places entries/counts while reducing the follow-up response from 17,914 to 6,013 bytes. The client reuses navigation metadata; it does not need to receive counts, folders and sessions on every category change. Initial responses were approximately the same HTTP size (the new wrapper adds a few bytes); this is not a claim that first HTTP response size shrank. The indexed database queries project summaries instead of loading source prose for normal browsing. Search and any unready/stale data retain the legacy path.

Post-storage-fix sampling comprised 40 spaced API reads (ten per area) and fresh-browser openings. The first API sample's maximum was 2.86 seconds, but later matched controls included a 6.94-second full response. The sample is finite, and neither a low observed maximum nor a small-sample p95 proves a worst-case bound. Matched checks and real-browser checks were small interactive workloads, not a controlled load or capacity test; some read checks overlapped.

Fresh-browser Compendium full-page openings reproduced 7.98 and 6.46 seconds. In the traced 6.46-second opening, the HTML document took 2.63 seconds despite a CDN HIT; cached main CSS took 1.88 seconds; the Compendium browse request took 773 ms with an 81 ms application handler. Requests overlap, so those durations must not be added as independent phases.

The post-rollout public Notebook browser opened in 8.29 seconds while its initial handler reported 24.1 ms and negligible connection-readiness time. A staged trace similarly opened in 9.72 seconds with a 27.7 ms handler: its HTML connection phase took about 1.44 seconds, and cached Notebook resources waited about 1.76 seconds for response headers. These observations locate substantial delay outside the measured handler, but do not uniquely distinguish client/network transport, CDN queueing, protection/routing or unmeasured platform startup.

A separate public HTML GET through curl also took 4.81 seconds: DNS 42 ms, TCP connected at 1.95 seconds, TLS completed at 3.10 seconds, first byte at 4.81 seconds. This demonstrates a slow delivery path independently of Notebook queries. It does not prove which network or hosting component is responsible.

Actual in-app clicks were checked separately from full page reloads. After the dashboard established the origin connection, the first Compendium visit opened in 991 ms; subsequent visits took 420/394 ms. That cohort retains the application shell and then its route/cache state; it is not a controlled before/after comparison with fresh page loads. No page errors or API writes occurred.

The conclusion is bounded: Notebook data preparation, indexed reading and navigation reuse are verified. Long cold/full-page delivery waits still occur. A paid database upgrade has not been shown to fix them. Next latency work should isolate the connection/CDN/static-asset path and compare equivalent in-app versus full-load scenarios; it should not assume all elapsed time is a database query. Existing aggregate DB durations can overlap, and the old timing middleware can overattribute its shared-listing flag to the new readiness probe; use the explicit reader header to identify the execution path.

## Rollback, credentials and evidence

Rollback target: `dpl_E2ip2awvreuounCuJcxViuPYgj7a`, the compatible writer with reader off. The task-owned release helper checks the current alias before promoting it. Keep additive indexes/metadata in place; do not restore an old writer or rewrite source prose as a reader rollback. Any source restore must account for legitimate writes made after the backup.

The temporary audit account can now be returned to read-only. No additional credential is needed for the full-site read audit.

Evidence lives under `.local/notebook-rollout-20261103/`: source scope/manifests, consistent backup and restore records, migration/source-hash verification, production/final preflight, staged/public response checks and browsers, hosted fixtures/cleanup, measured request/resource timings, and release/promotion records. Private backups/authentication fixtures are ignored by Git and must not be committed or shared. No Git commit/push was made; publication used Vercel deployment promotion.

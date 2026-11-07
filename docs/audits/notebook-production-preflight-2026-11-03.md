# Notebook production database preflight

**Later same-day result:** the [guarded Notebook rollout and latency verification](notebook-rollout-and-latency-2026-11-03.md) are now recorded separately. The populated campaign was backed up, rehearsed, prepared and enabled after compatible writers were published. The read-only findings below describe its earlier unmigrated state.

Read-only production access succeeded on 3 November 2026 using a privately submitted connection string. No credentials or note prose are included here. The checks used the raw MongoDB driver, not Mongoose model initialization, and did not deploy code, write records, create indexes, backfill or certify a room, or enable the indexed reader.

## Readiness findings

- The inspected existing room contains 92 entries, including deleted entries where present. All 92 lack version-1 derived listing metadata; the room is uncertified. This is the expected unmigrated state, not evidence of damaged source notes.
- All five proposed Hungarian-collation indexes are absent. The existing legacy room/section index is present and usable.
- The bounded consistency scan completed over all 92 entries (134,439 UTF-8 body bytes). Its `invalid:92` field means their stored derived metadata does not match the proposed representation because it is absent; it does not mean their source text is corrupt.
- Separately computing the proposed derivation in memory for every entry produced **zero errors**. No computed metadata was saved. This check is not a substitute for the guarded backfill/certification after compatible writers are deployed.
- Room authorization/readiness scope was unchanged before and after each check.
- Proposed-reader query-plan checks were correctly skipped: exact new indexes and complete consistent stored metadata are prerequisites.

## Current legacy query baseline

One retained-cache direct database observation from this machine:

- New connection setup: 508.6 ms; five subsequent ping round trips: 14.0–19.9 ms.
- Six current legacy query plans: DM/player across All, Journal and Story items. Every winning plan used the existing `roomId_1_kind_1_section_1_deletedAt_1_title_1__id_1` index; no blocking database SORT. The legacy route sorts/parses in JavaScript, so absence of a database SORT is not proof that sorting has no cost.
- Plans examined at most 92 documents/keys. MongoDB reported 0–1 ms execution; explain request round trips were 15.4–17.0 ms.
- An actual whole-room legacy projection (excluding cover images/gallery) returned 92 entries, 181,982 BSON bytes, in 62.0 ms. In-memory derivation took 2.7 ms. BSON bytes are database transfer size, not HTTP response size.
- Command monitoring recorded only ping, find, listIndexes, explain and session-end commands. No write or index-build command was issued.

These finite observations do not reproduce or explain the historical six-second Notebook stalls. They suggest that a large collection scan or excessive note-body volume is not the immediate bottleneck for this room in this sample. They do not rule out intermittent database/serverless cold starts, backend contention, network delays, browser asset delivery or supporting request dependencies. A direct connection from the workstation differs from the Vercel handler's connection path. The larger synthetic indexed-reader gains must not be extrapolated to this 92-entry production room.

## Decision and remaining work

**Subsequent bounded fix:** [production storage startup](production-storage-startup-2026-11-03.md) removes repeated automatic collection/index setup from cold production processes, after verifying the existing storage and testing normal writes. It is now live. This does not migrate Notebook data or establish that every intermittent delay is fixed.

The user reports **AWS / Frankfurt / Free**. MongoDB's current terminology is Free; its former name is M0, so no M-number needs to be found in the UI. This is user-reported Atlas configuration, not an independent Atlas administration check. Recent production runtime records independently confirm the application's execution region as `fra1` (Frankfurt).

[Atlas Free limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/) include 100 read/write operations per second, 10 GB ingress and 10 GB egress per rolling seven-day period, and 0.5 GB data plus associated indexes. Exceeding throughput or transfer limits can introduce network throttling and a one-second cooldown, with longer queued waits possible. This is a plausible mechanism, not evidence that this cluster hit a limit. Free clusters also lack downloadable database logs and the Performance Advisor; the app's existing timing logs remain useful.

Read-only `dbStats`/`collStats` show 155,112,232 logical document bytes and 6,086,656 index bytes in the configured application database; the Notebook collection has 122 total records (including folders), 1,900,144 logical bytes and 118,784 index bytes. This does not account for any other databases on the cluster or establish current throughput/transfer headroom. Monitoring recorded only `dbStats`, `collStats` and session-end commands.

Five recent production timing records for the inspected room all completed with HTTP 200, no failed or unfinished database commands, and region `fra1`. Handler durations span 23.32–1,185.77 ms. One small Notebook read spent 742.18 ms in connection readiness with 14 ms accumulated command time; another spent 639 ms in commands with 0.08 ms readiness. Two listing reads recorded 669/762 ms accumulated command duration: their actual entry-listing buckets were only 12/61 ms, while room/character/folder support buckets were 657/701 ms. Those support buckets contain several commands and cannot distinguish which individual query waited. Driver command duration includes network/server waiting and is not pure query execution; overlapping command durations cannot be subtracted from handler time as CPU cost. These records support investigating connection readiness and authorization/support reads before optimizing note derivation further. They do not reproduce the earlier six-second tail or prove Free-tier throttling.

The CLI rejected the initial two-hour log window because the Hobby plan did not retain it. A bounded 15-minute window succeeded; this is the scope of the five observations, not a long-term percentile study. Sanitized evidence: `recent-runtime-timing.json` and `production-capacity.json` under the existing local evidence directory. Raw runtime records remain private.

Keep the published startup improvements and legacy backend. Do not enable the new reader on an unprepared room. The former credential and hosting-identification blockers are resolved. There is no demonstrated geographical mismatch or storage exhaustion in the inspected application database, and no evidence yet that a paid upgrade would eliminate the waits. Current cluster-wide throughput/transfer pressure, production-sized index-build/write cost, backup restore rehearsal and old-writer drain remain outstanding. Prioritize tracing a real slow request and correlating it with Atlas metrics before undertaking the broader migration solely to address this small room's startup latency. The proposed reader uses additional count/navigation queries; its benefits on a 3,600-entry fixture do not establish lower latency or less operation pressure for this room.

Evidence: `.local/startup-release-20261103/production-preflight.json` and `production-notebook-baseline.json`. Source prose and credentials are not written to either report. The latter harness performs only raw-driver reads and summarizes counts, plans, bytes and timings. See [the startup release report](startup-release-2026-11-03.md) and [the rollout runbook](notebook-rollout-runbook-2026-11-02.md).

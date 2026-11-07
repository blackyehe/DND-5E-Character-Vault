# Startup improvements: production release and remaining work

**Final same-day update:** the [guarded Notebook campaign rollout](notebook-rollout-and-latency-2026-11-03.md) is now live after backup/rehearsal and production checks. Its latency verification still records unresolved cold/full-page delivery waits; the full-site audit is pending.

**Later same-day release:** the [production storage startup fix](production-storage-startup-2026-11-03.md) is now live on top of this release, changing only production connection setup and adding a test. All startup features below remain included; the indexed Notebook migration stays held.

Published on 3 November 2026 at 09:57 UTC to https://dndoldal.vercel.app. Deployment: `dpl_7XgQUB7b5CmhyXAZTcuEyVSKkTb6`; immutable URL: https://dndoldal-fgido0dg8-dndenjoyerstudio.vercel.app. Rollback: `dpl_6DxQ5VUiqmDPXj8YQFBiMXsQRdki` (the previous Workshop release, retaining the map improvements).

## What is live

- Character Creator initially requests selection metadata and fetches complete definitions when selected. Exact account/library revisions prevent mixing incompatible rules; stale selections have a visible Retry library action. Existing full-response clients remain supported.
- Compendium starts an authoritative browse after a 200 ms device-cache head start, cancels the losing request, and defers the editor/file manager. Access denials and account changes clear or reject stale results.
- Notebook player preview stays on Notebook or Maps. Character sheets and the party dashboard load when requested. Players begin with All; link targets start alongside the legacy listing. Room member/character reads overlap after authorization. Parallel access-loss failures invalidate late listing responses.

The release was reconstructed from the exact previous published source, rather than deploying the mixed root checkout. The 460-file hosted source audit matches its frozen SHA-1 manifest exactly: 13 runtime files and 11 tests changed. Notebook backend routes, models, schema, writers, environment, shared response types and large-transfer middleware remain byte-for-byte prior production. There was no database migration, index creation, backfill, certification or indexed-reader enablement. Unfinished extension/authentication and large-response changes were excluded. No Git commit or Git push was made.

The Vercel access failure was an expired saved CLI session; the existing CLI refreshed it successfully before deployment. Production access is working.

## Release evidence

- Frozen release: 135 tests passed, two optional skips; frontend production build and backend TypeScript passed.
- Fresh loopback Express/Mongo lifecycle: eight aggregate checks across 38 HTTP requests; temporary database removed and processes stopped.
- Ten built-browser fixture scenarios passed, including cache races, access loss, selected definitions and explicit sheet loading.
- Hosted synthetic-library checks covered native/imported definitions, publication changes, stale revisions, authorization and exact BOM exports. Temporary packs/characters were cleaned up.
- Same real-owner library: full creation JSON **2,696,833 bytes**, selection JSON **506,709 bytes**, an **81.21%** reduction. Identities, ordering and selected definitions match. This measures decoded payload, not a guarantee of cold database assembly speed.
- Public browser checks produced no page errors or server writes. Observed creator opening: 747 ms; Compendium: 843 ms; DM Notebook All-list interaction: 1,885 ms. These were finite observations in one fresh browser context, with retained origin caches and sequential navigation. Notebook timing includes the explicit All click. They are not controlled cold-start comparisons against the historical 9.8/7.8/6+ second cases.
- Public frontend matches the reviewed build; unauthorized startup returns 401. Existing map source bytes, metadata, pin/region coordinates, both overview images and conditional 304 reads remain correct.

Review and public HTTP observations support faster creator transfer, but the server still constructs the existing catalogue before projecting metadata. Feat effect-text search still loads the whole feat category when needed. A slow but ultimately healthy Compendium cache validation can trigger one unused browse; cancelling HTTP cannot guarantee already-started database work stops. Platform/network tail latency remains a separate measurement task.

## Remaining Notebook work: local only

The broader indexed reader/navigation-cache prototype remains unpublished. Further investigation added:

1. `NOTEBOOK_DB_ROOMS`: blank admits no rooms; an explicit comma-separated list admits only those rooms; standalone `*` deliberately permits all certified rooms. The global flag and exact room certification are still required.
2. A raw-driver, read-only preflight CLI. It checks metadata counts, index keys/collation, bounded full derivation consistency and winning query plans without initializing models, creating indexes, writing metadata, certifying or enabling the reader. An explicit database and room are required. Source prose is not logged.
3. A corrected benchmark that explicitly enables and certifies the after cohort, asserts the actual indexed projection and rejects silent fallback. The earlier harness did not reliably establish that the optimized path ran; historical output is retained separately and must not be used as proof of indexed-reader gains.
4. A correctness repair found by that stricter harness: missing derived metadata outside a selected page/category could corrupt counts or exclude an entry. Navigation now detects this within its existing aggregation; slim listings add a parallel metadata-existence read. Either case falls back to the legacy reader. This adds work to slim reads and is included in the new fixture measurements. It detects missing/obsolete versions, not arbitrary same-version external corruption; consistent writers and fresh certification remain mandatory.

Fresh MongoDB fixtures with 3,600 notes, 60 packs and 1,500 definitions passed all 24 DM/player listing combinations and 34 regression comparisons. Response contracts match the legacy baseline exactly, including fallback and drift repair. Winning query plans have no blocking SORT. The read-only preflight fixture passed four checks, including command monitoring, drift and ownership loss, with 24 prepared-room plans and no writes. Both fixture databases were removed and processes stopped. These are synthetic loopback results, not production latency claims.

Final root ordinary suite: **964 passed, 67 conditional skips** across 129 passing files. Backend TypeScript passed. The preflight CLI also rejects a connection string without an explicit database before attempting to connect.

**Subsequent production preflight:** private database access is now working. The inspected room has 92 entries, all without the proposed derived metadata, and none of the five new indexes. This is the expected unmigrated state. All source entries derive successfully in memory; nothing was saved. Current legacy query plans use the existing index and report 0–1 ms MongoDB execution in one direct-connection sample, which does not reproduce the historical multi-second stalls. The proposed reader's plan checks remain skipped until its indexes and stored metadata exist. The user reports Atlas AWS / Frankfurt / Free (formerly M0); application runtime logs independently confirm Frankfurt execution and show variable connection/command latency. Read-only application database statistics do not show storage exhaustion. Current cluster-wide throughput/transfer pressure, production-sized index-build/write costs, backup rehearsal and old-writer drain remain unverified; the broader rollout stays held. See [production findings and limitations](notebook-production-preflight-2026-11-03.md) and the [updated rollout runbook](notebook-rollout-runbook-2026-11-02.md).

## Evidence locations and rollback

Task-owned evidence is in `.local/startup-release-20261103/`: `scope.json`, `expected.json`, `audit.json`, `promotion.json`, `public-smoke.json`, `public-browser.json`, `public-evidence.json`, release test/build logs, fixture cleanup records and final root checks. New synthetic matrix output is in `.local/notebook-query-20261103/`; historical November 2 output is unchanged. Private owner responses/authentication fixtures stay local and must not be committed or shared.

The release helper's explicit `rollback` command promotes the retained previous deployment, checking that this release is still current first. Any future fix should again be isolated from the dirty root; do not publish the root checkout wholesale.

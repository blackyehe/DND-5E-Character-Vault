# Foreground source-cache lookup exploration - 1 November 2026

Published and publicly verified on 1 November 2026. Baseline: published visible-page preloading, Git checkpoint `1da6c17`, deployment `dpl_HanC2oYaQWa2ewDE72eTK1PXiLDa`. This is an incremental change to normal imported-entry reads. The optional preloader already combines cache lookups and is unchanged.

## Candidate

Replace the two sequential compatibility/current cache reads with one indexed `findOne` over the two exact revision keys, sorted by revision. The fixed namespace prefixes sort legacy first. Return only one payload, rather than downloading both cached versions. If the selected legacy value is invalid, query the current key separately, preserving the existing fallback.

The legacy-only reader remains on its exact single query. Ownership, category, entry ID, expiration, digest/decompression/shape checks, prepared/targeted fallback, pending-read coalescing and persistence keys are unchanged. Library revision checks outside this function remain intact. No cache-format, schema, index, dependency, frontend or authoritative-source changes.

## Measured local costs

A uniquely named loopback MongoDB fixture exercised the actual candidate against the prior cache-query logic. It uses synthetic payloads and 500 unrelated rows to check real index selection. The dual-valid case inserts the current row first so insertion order does not supply legacy preference.

| Case | Prior reads | Candidate reads | Selected value |
| --- | ---: | ---: | --- |
| Valid legacy only / both valid | 1 | 1 | Identical legacy winner |
| Current only | 2 | 1 | Identical current value |
| Both missing | 2 | 1 | Identical fallback |
| Invalid legacy, valid current | 2 | 2 | Identical current value |
| Expired legacy, valid current | 2 | 1 | Identical current value |
| Foreign/wrong revision/category/index | 2 | 1 | Identical miss/fallback |
| Legacy-only reader | 1 | 1 | Identical legacy value |

All eight scenarios preserve the result. All use the existing index without a collection scan or blocking sort. In the dual-valid case only one document is examined and one payload transferred. Payload bytes are identical to the prior reader in every scenario. The candidate adds the returned namespace field (29–49 BSON bytes in this short-revision fixture; real revision strings are longer), not an extra full entry.

This establishes one fewer database exchange when the legacy cache misses. It does not establish a live millisecond saving or a proportional improvement to the complete click time. A valid legacy hit already used one read; invalid legacy values still require two. No real library, server caches or hosted settings were modified. The guarded fixture database was removed.

## Verification and decision

43 focused tests pass across cache selection/coalescing/persistence, optional preloading, targeted sources, detail freshness, browsing and HTTP routes. Backend type checking and whitespace checks pass. No frontend build or full-library replay was repeated for this isolated server change.

Decision: published after a narrow hosted review and public verification. The measured extra work is minor and it removes a read in the intended cases. No live millisecond saving is claimed; the older preloading and full-library-rebuild measurements are separate.

Changed runtime: `server/lib/compendium-entry-source.ts`. Added regression coverage: `server/lib/compendium-entry-cache.test.ts`. Ignored probe and results: `.local/cache-lookup-exploration-20261101/`. Original unrelated dirty work remains preserved.

## Published release

- Production: `dpl_922Tuz5hpV7iS3Tuv45pju2hNDVe`, https://dndoldal.vercel.app.
- Rollback: `dpl_HanC2oYaQWa2ewDE72eTK1PXiLDa`.
- Frozen deployment matches all 421 runtime inputs; only the cache-reader runtime file changed from the previous deployment.
- Hosted and public HTTP boundary checks passed. Seven read-only real-library checks passed on both hosts: same account, five complete imported spell/class responses matching the previous release and stable repeated reads, and foreign-account isolation. Unauthenticated reads remained blocked and private responses remained no-store.
- Release evidence: `.local/foreground-cache-release-20261101/`. The existing 43 focused tests, backend type check and eight guarded database cases were reused; no unrelated benchmark or frontend build was repeated.

## Other local work

The verified website branch had no unpublished commits before this patch. Comparing 373 application source files in the original checkout found only the separately held Owlbear remembered-login implementation and its staging/test support outside the released website runtime. Preserve that work; it is not included in this release. Other dirty website copies match the verified release branch.

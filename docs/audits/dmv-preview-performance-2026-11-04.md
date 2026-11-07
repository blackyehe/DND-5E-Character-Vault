# DMV preview performance — 4 November 2026

The file-import preview improvement is live at `dpl_7mSUPFstkSkNT1AuxEXR7pGB7tRk` on both website aliases. Automated hosted and public checks pass. It changes three server runtime files and adds four test files, with 487 exact source/test inputs derived from the previous published release `dpl_G4VcVwyRjnkwauifkNHbhxzVX1ir`. No frontend, database configuration, hosting region or environment variable names changed. No character was saved or campaign restored during these checks.

## Cause and correction

The original preview fetched every Orcbrew source and rebuilt the import catalogue. A local process using the original backup decoded 90,058,146 bytes across 126 packs; parsing alone took 3,117 ms. The original converter also waited on serial external rule reads: one representative conversion made 41 fetches with maximum concurrency one. These local observations identify avoidable work, not production-stage timing bounds.

`server/lib/dmv-catalog.ts` now reads the seven required categories from existing, verified derived components for owners already enabled for the prepared reader. It rechecks source identity and sharing/disabled metadata after assembly. Missing, corrupt, racing or unavailable components fall back to the complete original reader. The preview never repairs components or writes a cache. A 2.5-second component deadline bounds this attempted shortcut, rather than the whole import.

`server/lib/dmv-import.ts` reuses the site's pinned 2014 spell, equipment and magic-item definitions when the configured service is the standard public 2014 API. Unknown entries and explicitly configured alternative services retain upstream lookup. The complete upstream objects are not byte-identical to the snapshot: metadata and unused empty fields differ. Acceptance therefore compares actual complete converted previews, including warnings and exact source, rather than claiming the datasets are identical.

The converter also overlaps exactly the class-level and feature reads it already consumes. Four workers warm at most 128 level jobs while ordinary conversion continues; the existing shared request queue, pace, retries and lookup deduplication remain. Character assembly stays ordered, and speculative failures produce warnings only when the original conversion order consumes the rule. Four warming workers plus the ordinary conversion can have five pending fetches. This is bounded overlap, not a general increase in the upstream queue's request rate.

The preview route exposes safe catalogue/rule stage durations in `X-Dmv-Stage-Timing` and the chosen reader in `X-Dmv-Catalog-Reader`. Existing `Server-Timing` continues to report application/database duration. Responses remain authenticated, validated and `no-store`.

## Positive-effect and correctness evidence

An isolated loopback Mongo replica imported the actual backup into a synthetic owner. Its required catalogue values, IDs, precedence and aliases match the original reader. The original catalogue took 5,078 ms; the prepared catalogue took 103 ms and read no raw source strings. The original query returned 67,259,611 bytes of source strings, measured after decoding rather than as compressed wire traffic. Neither reader wrote data. Missing-component fallback also passed. The fixture database was dropped and its Mongo process stopped.

That catalogue/route fixture belongs to the first, unpublished candidate and is reused because those implementations did not change. New scheduling has separate regressions and a replay of all six original characters. All six previews match the original converter, excluding only the deliberately fresh import timestamp. Captured public rule responses let this replay run without new live upstream requests: the original conversions used 243 fetches, while the final candidate used 152. Source and warnings remain exact.

A controlled replay with a synthetic 200 ms delay per fetch isolated scheduling effects. Sequential conversion took 5,478 ms; bounded overlap took 2,572 ms. Both used the same 25 response bodies and requests and produced the same preview. These are artificial-latency results, not hosted measurements.

The final hosted acceptance alternated the previous immutable deployment and candidate using the same original character source. All returned the same preview, excluding the timestamp, and before/after character lists matched.

| Measured pair | Previous release | Final candidate |
| --- | ---: | ---: |
| First pair, previous then candidate | 13,181 ms | 2,611 ms |
| Repeat pair, candidate then previous | 8,976 ms | 768 ms |

The candidate reported the prepared reader in both cases. First-pair catalogue/rule stages were 398/1,799 ms; repeat-pair stages were 254/187 ms. These are finite measurements with retained platform/upstream caches, not guaranteed cold-start or percentile comparisons. They establish positive effect for the checked source and conditions. The first post-promotion public preview took 2,249 ms, with the same output and prepared reader; its stages were 316/1,786 ms. Remaining upstream reads can still take seconds.

## Verification and release

- Full final suite: 272 passed, two conditional external-pack tests skipped. Those external-pack cases passed separately during the preceding audit. An initial run alongside concurrent build/type checks hit an existing five-second timeout in an unchanged large-source export test; the full suite rerun alone with two workers passed without changing application code or the timeout.
- Server and frontend type checks and the actual Vite production build passed. Frozen input hashes stayed unchanged throughout validation.
- New regression coverage checks prepared-reader gates, complete fallback, source races and privacy metadata, snapshot/alternate-service behavior, provider statuses, URL restrictions, deterministic feature/warning order, worker bounds and deduplicated requests.
- Hosted and public read-only API checks match the previous release across characters, rooms, creator, Notebook, sessions, links, Workshop and Maps. Auth boundaries, indexed Notebook reading and health pass.
- Fresh automated desktop/mobile browser checks pass for auth labels, protected redirects, missing-route recovery, dashboard and Compendium browsing/detail. No mutation requests or uncaught browser errors occurred. These checks do not constitute a fresh full-site audit.
- Hosted source inspection matches all 487 expected inputs. Both website aliases target the final deployment; both Owlbear aliases remain on `dpl_6yPZh1hytcg8a2XNzSHnRpZjpz8W`. Frankfurt (`fra1`) and environment variable names are unchanged.

The first catalogue/snapshot prototype `dpl_6sH5YVdh8rWcCHNn8FYkt5DADebL` stayed unpublished. Its remaining rule-stage delay motivated the final bounded-overlap candidate. Only the final candidate was promoted. Rollback is the compatible previous release `dpl_G4VcVwyRjnkwauifkNHbhxzVX1ir`, using `node .local/dmv-preview-parallel-20261104/release.mjs rollback` while the alias still points to this candidate. No Git commit, push or PR was made.

Private fixtures, exact manifests, helpers and machine-readable results remain ignored under `.local/dmv-preview-20261104/` and `.local/dmv-preview-parallel-20261104/`. The latter includes `validation.json`, `reused-fixture.json`, `preview-parity.json`, `delayed-replay.json`, hosted/public acceptance, promotion and `final-gates.json`. Reports contain no credentials or original character contents.

## Remaining issues

All six saved DMV links return HTTP 200 from this machine. The hosted fetch of a representative link receives upstream HTTP 403. This establishes host-specific provider refusal, but not its precise cause, such as a particular firewall or IP policy. The old response incorrectly conflated 403 with missing/private characters. The release returns a fixed explanation and numeric `sourceStatus: 403`, with no upstream body disclosure, and directs the user to the verified file fallback. HTTP 404 retains the existing unavailable response. URL allowlisting, redirect refusal, credentials restrictions, timeout and size limit remain intact.

A successful hosted public-link import remains unresolved. The direct response had no browser CORS permission, so a browser-fetch shortcut is not established. No third-party proxy, CORS bypass, provider credentials or access-control workaround was introduced. Provider cooperation or a supported export path is needed before treating hosted URL import as reliable.

The intermittent full-navigation delivery delay also remains unresolved. Six separate curl processes through normal DNS and two just-observed IPv4 destinations returned identical HTML in 70–383 ms with no proxy. TCP and TLS did not show multi-second waits in this sample. OS DNS/TLS and CDN caches were retained; this does not disprove earlier intermittent delays. No DNS, OS networking or paid hosting changes are justified by this sample. Further investigation needs a trace captured when the delay recurs; routine warm polling would not establish the cause.

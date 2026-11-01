# Compendium metadata batching - published 1 November 2026

Published with visible-page preloading; [release evidence](visible-compendium-details-2026-11-01.md). Comparison baseline is the current query in website checkpoint `3b55e79` (runtime equivalent to live pause-feedback deployment `dpl_6fm5k6C6Ad6ArkMw77cp73Bt1ijA`), not the older full-library rebuild.

## Change

`browseRevision` requests cursor batches of 512 small projected metadata records. The owner/type filter, projection, ordering, revision format and all before/after freshness checks are unchanged. Batch size is not a result limit; MongoDB can return further batches and retains its wire-size limits. No imported source, character, room, authentication or frontend behavior changes.

## Focused comparison

The existing loopback-only harness now compares the prior default-batch query with the actual changed application function. It does not compare two copies of the candidate query. Fixtures contain synthetic metadata, foreign-owner and excluded-type records; no private library sources are loaded.

| Matching records | Prior query commands | Local query commands | Complete revision |
| --- | ---: | ---: | --- |
| 0 | 1 | 1 | Identical |
| 126 | 2 | 1 | Identical |
| 600 | 2 | 2 | Identical; all records retained |

For 126 records this removes one cursor-continuation exchange per revision check. A request performing two such checks can avoid two exchanges if both reads fit this case. This is not a 50% improvement in complete entry-opening time. No current live latency saving has been measured, and there is no improvement in command count for the empty/600-record cases above. Existing cached entry opens may make no affected request.

The unique local fixture database was removed after the host/name guards passed. Ignored raw evidence: `.local/metadata-batching-20261101/comparison.json`.

## Validation and scope

- 30 focused tests pass across browse caching, detail freshness, targeted source resolution, prepared/large-pack fallbacks and the browse route.
- Backend type checking passes; whitespace checks pass.
- The existing browse test mock accepts the new query-chain method. The real database harness provides result-equivalence/cursor coverage; no test merely asserting the literal batch size was added.
- No frontend build, full library replay or broad test matrix was repeated for this server query change.

Changed runtime file: `server/lib/compendium-browse.ts`. Development changes: the existing browse test mock and metadata-probe harness, plus these notes. Original unrelated dirty work remains excluded. Hosted and public validation are now recorded in the linked release report. The query-level comparison below remains a local command-count result, not a live latency measurement.

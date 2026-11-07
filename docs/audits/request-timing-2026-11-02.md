# Independent request timing

Published independently on November 2: see [the production release and collection report](request-timing-release-2026-11-02.md). Deployment details below the preflight notice are historical.

Production preflight supersedes the old 9d2c605 deployment base: see [the verified live-source package and log-retention setup](request-timing-preflight-2026-11-02.md). The older patch below remains historical development evidence; do not deploy it over the newer public release.

Instrumentation only; no deployment performed. The main worktree retains earlier unrelated changes. Apply `.local/request-timing-20261102/instrumentation-only.patch` to commit `9d2c605555bdb9eb364eeb60d3450a61cca218bd` to ship timing first. The isolated source is `.local/request-timing-20261102/standalone/`. The patch includes no notebook optimization, indexes, schemas, derived fields, migration, feature flag, dependency or query changes. The main worktree also has small cache observations for newer preload helpers that do not exist in that older commit; the middleware covers these endpoints whenever they are present.

## Coverage and format

Every selected GET/HEAD request logs one JSON line via the existing `console.info` logger, including failures and interrupted responses. Coverage is `/api/rooms/:roomId/notebook` (search and no-search), its navigation/link-target and detail/history reads, and all `/api/compendium-browse/*` and `/api/compendium/*` reads, including detail-batch preloads, validation and compressed local-index exports. Category, quest, tag, folder counts and session links are returned by the notebook listing request; they are not separate HTTP endpoints and do not create fictitious extra request logs.

Fields include `event`, a generated `requestId`, a fixed endpoint name, `role`, allow-listed `section`, status, `handlerMs`, `dbMs`, `dbRoundTrips`, failed/in-flight round trips, `dbReadyMs`, response bytes, application compression, completion and sampling. Notebook logs also have listing/navigation/count/other DB milliseconds, `dbSharedListingRead`, and listing search-used/offset/result-count fields. Compendium logs include `entriesRead`, `resultsReturned` and cache status. No URLs, route parameters, IDs from the application, query values, request/response bodies, names, titles, tags, search terms, document payloads or raw database errors are logged. The generated random request ID is unrelated to a user identity.

`role` is DM/player after the existing room access check, including player preview. It is null for unauthorized/unresolved requests and personal Compendium reads: those have no single room-specific DM/player role. Section is null when absent/inapplicable or invalid. Unknown metrics remain null rather than guessed.

## Meaning of the numbers

- `handlerMs` spans middleware entry to response finish/close, including application processing, connection wait, serialization and application streaming. It is not browser time or pure CPU time.
- `dbMs` sums Mongo driver command durations, including failed commands and cursor continuations. This includes command delivery, not isolated server execution; pool wait and initial connection setup are not driver round trips. Existing connection-readiness timing is logged separately as `dbReadyMs`. Concurrent command durations overlap, so their sum can exceed handler elapsed time. A shared in-flight cache task's physical DB commands belong to the request that started it, not every waiter.
- The original notebook's entry query supplies both listing rows and navigation/count data. Its duration is charged once to `dbListingMs` and marked `dbSharedListingRead:true`; `dbCountsMs:0` means there was no separate count command, not that deriving counts was free. Folder/access reads are navigation. Independent aggregate/count commands are counts; indexed session/link reads are navigation. Cursor continuations retain the originating command bucket. No query comments or query options are changed to obtain attribution.
- `responseBytes` counts body bytes accepted by `res.write`/`res.end`, preserving callbacks, return values, backpressure and headers. No second serialization or buffering is performed. `compressed` reflects application `Content-Encoding`; `compressionScope:"application"` explicitly excludes later CDN/platform compression. For interrupted responses, queued bytes need not equal delivered bytes. HEAD/304 responses have zero emitted body bytes.
- `entriesRead` reports consulted index entries when an index reader supplies that count; otherwise it uses the logical entry count of a JSON result. `resultsReturned` is separately counted from the final JSON result. Metadata-only requests can have null counts; compressed exports use the known index count without inflating their body. These are logical rule entries, not BSON documents or a unique count across retry attempts.
- Cache observations are taken at existing read decisions after validation. `hit`/`miss` identify those decisions; `mixed` means the request encountered both. Bundled public-rule reuse is a hit, and the existing upstream SRD promise cache is observed too. `not-observed` means no instrumented cache decision occurred, not a cache miss. No cache lookup, invalidation, TTL, fallback or response behavior changes.
- Pending commands at response end contribute their elapsed portion and are identified by `dbInFlightAtEnd`; later completion is not counted again. Bookkeeping is cleaned on response completion, and one bounded cursor map plus three listeners is installed per Mongo client, not per request or query.

## Switches and reading logs

`REQUEST_TIMING=off` (also `0`/`false`) disables instrumentation; default is on. Set `REQUEST_TIMING_SAMPLE_EVERY=5` for exactly one out of every five eligible requests per process, or leave unset for every eligible request. These environment switches are independent of all feature flags. Restart the process after changing them so Mongo monitoring configuration follows the switch.

For a saved application log file:

```powershell
node scripts/summarize-request-timing.mjs server.log
```

This ignores unrelated lines, accepts plain JSON lines or JSON `message` envelopes, excludes incomplete responses, and prints per-endpoint request counts plus nearest-rank p50/p95 and maximum handler and DB times (`handlerMaxMs` and `dbMaxMs`). Percentiles describe the recorded sample; compare equivalent role/section/search/offset/cache cohorts for performance conclusions. The optional `scripts/request-timing-summary.jq` provides the equivalent plain-JSON-line analysis with `jq -Rs -f scripts/request-timing-summary.jq server.log`.

## Validation

Focused middleware and existing notebook/Compendium/SRD tests pass (82 tests in six files). The four wrapper tests also pass in the isolated pre-change checkout, independently of notebook optimizations. Tests verify response bodies/headers, sizes, gzip, streaming, empty/error responses, privacy, concurrent attribution, enable/disable and exact 1-in-5 sampling. A real Mongo loopback fixture verified concurrent requests and all six round trips per request including cursor continuations; its temporary database was removed and the application database was not modified. The summary script was exercised against plain/wrapped JSON plus unrelated log lines. Runtime backend typechecking passes; previously documented Owlbear errors still prevent a clean full baseline server typecheck and were not changed.

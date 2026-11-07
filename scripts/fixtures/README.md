# Retained notebook and Compendium fixture

Run from the repository root with local MongoDB listening on `127.0.0.1:27017`:

```powershell
node --import ./server/node_modules/tsx/dist/loader.mjs scripts/fixtures/notebook-compendium.mjs
node --import ./server/node_modules/tsx/dist/loader.mjs scripts/benchmarks/notebook-navigation.mjs before
node --import ./server/node_modules/tsx/dist/loader.mjs scripts/benchmarks/notebook-navigation.mjs after
node --import ./server/node_modules/tsx/dist/loader.mjs scripts/benchmarks/notebook-navigation-checks.mjs
```

The seed and database are retained. The fixed database is `notebook_navigation_fixture_v1`; commands never use the configured application database or drop a database. The seed replaces only its deterministic synthetic IDs and creates indexes only in that fixture. It contains 3,600 notebook entries with deleted, DM-only, room-wide and character-specific cases, two assigned characters, and 60 imported packs/1,500 definitions for each of the DM and player owners. Re-running the seed restores the original records. Permission probes restore every changed record in `finally`.

The fixture harness explicitly enables `NOTEBOOK_DB_LISTING=on` (override with `NOTEBOOK_FIXTURE_DB_LISTING=off`); the application defaults to `off`. The seed certifies its room through the same complete-room consistency checker as the backfill. Missing, older or newer room marker versions always use the JavaScript reader, as does flag `off`. Search continues to use the JavaScript reader. Permission probes compare current-marker responses with missing/old marker and flag-off responses for both roles.

The seed also builds `notebook_count_scope_hu`, a Hungarian-collation compound index on room, kind, deletion state, audience, character IDs, section and derived category. This covers the player count for the common section/category lists while preserving the exact filtered total displayed by the UI and the existing `entries/total/nextOffset` contracts. Folder/tag/quest-status/character filters can still need document reads; inspect the per-query execution plans rather than assuming every count is covered. Adding the index to the schema does not deploy or build it in production through these fixture commands.

For rollout, finish deploying the shared-derived-field writers and transactional navigation counters to **all** application instances before running `server/scripts/backfill-notebook-listing.ts --apply`. Drain older writers first. `--check` is read-only. `--apply` clears markers in its room scope before modifying metadata and certifies only after completion, with a fresh full-room check (including hidden/deleted entries) and a compare-and-set on the room's transactional write counter. Incomplete, invalid or racing checks leave rooms on fallback. Resume with the same checkpoint; after a derivation-version bump use a new checkpoint. Enable the flag only after certification; set it to `off` to roll back without changing data. Out-of-band notebook writes must invalidate the room marker before changing source and recertify with the backfill; no application reader sets markers.

`before` measures the full/default listing; `after` checks that same contract and measures slim pages, navigation, and the first parallel navigation+page request. Both cover 32 DM/player cases across sections, orders, offsets, search, trash, tags and quests. One warmup precedes five measured requests; medians are reported. Execution plans are collected separately with `executionStats`. DB bytes count returned BSON cursor documents, not compressed network traffic. HTTP bytes are uncompressed body bytes. Query plans, examined documents/keys, round trips and source hashes are saved under `.local/notebook-navigation-20261102/`.

For an actual source-change comparison, capture `before` before editing and preserve that file. The backward-compatible default endpoint is also a control that remains available in the new source. Initial page+navigation costs and repeat-page costs are reported separately. Compendium before/after comparisons use the matched warm cohort; `firstObserved` is process-first with persisted fixture caches retained, and is not a matched cold-start comparison. These are fixture data, not production measurements.

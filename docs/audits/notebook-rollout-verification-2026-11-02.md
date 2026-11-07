# Notebook rollout verification

**3 November update:** the [startup release](startup-release-2026-11-03.md) preserves the previous Notebook backend/schema. The local indexed prototype now additionally requires `NOTEBOOK_DB_ROOMS`; blank allows no room. Its stricter benchmark exposed and repaired an off-page missing-metadata fallback bug. Fresh synthetic matrix and read-only preflight checks pass; production database/Atlas preflight is still outstanding. Historical checks below predate these changes.

This is a local implementation audit, separate from the timing-only release. No notebook flag was enabled, no index was built, and no backfill or certification command was run against production. The timing release contains the previously deployed notebook reader and schema byte for byte. Production notebook optimization remains on hold pending baseline measurements and database preflight.

## Local checks

On 2026-11-02, the five focused files passed all 73 tests:

```powershell
node node_modules/vitest/vitest.mjs run server/lib/notebook-derived.test.ts server/lib/notebook-backfill.test.ts server/lib/notebook-listing.test.ts server/lib/notebook-changes.test.ts server/routes/notebook.test.ts
```

These are local unit and HTTP fixtures, not fresh production query-plan or latency measurements. Earlier populated Mongo fixtures and their limitations are in [the notebook query report](notebook-query-2026-11-02.md).

- The optimized reader requires both `NOTEBOOK_DB_LISTING=on` and the room's `notebookListingVersion` matching `NOTEBOOK_LISTING_VERSION`. The environment defaults to `off`. Tests cover the disabled flag, absent/obsolete marker, valid marker and database operation selection.
- Backfill apply invalidates room markers before data updates. Certification performs a fresh complete-room consistency scan, including hidden and deleted entries, then sets the marker conditionally on the room change epoch. Tests reject drift and concurrent writes and cover an empty room. `--check` does not certify or mutate data.
- Missing or obsolete row metadata returns control to the legacy reader. A second row check after page/session reads handles rows appearing after readiness evaluation. Search remains on the legacy path. Route fixtures cover disabled/missing readiness and authorized DM/player results.
- `notebookDerived` is the shared computation; `notebookChanges` calls it with the merged source for query updates. A runtime-source search found notebook mutations in `server/routes/notebook.ts`; the map and city-library consumers read notebook data. Creation of entries/folders computes metadata; entry edits, tag edits, sharing edits, folder edits, delete, recover and version restore all use the shared update function. Route fixtures check consistency for every exercised write via `afterEach`. This audit does not guarantee consistency for arbitrary external database writes or future write paths.
- Backfill uses conditional `_id` plus `revision` updates, persists the cursor and retry IDs, resumes conflicts below the cursor, and preserves revision and timestamps. Checkpoints are bound to the database URI/database name, room scope and derived version. Tests cover a concurrent edit, resumption, certification and idempotence.

## Runbook for the later optimization release

1. Collect the independent production baseline first. Reconstruct the then-current live source and prepare the notebook change against that source, preserving the timing instrumentation and every unrelated released feature. Re-run local checks and review the isolated delta.
2. Verify Atlas region, tier and paused state through an authenticated session, alongside the backend execution region. Review capacity and transfer evidence. Do this before any writer deployment that could initialize new model indexes, explicit index builds, or backfill. The October 28 AWS Frankfurt/M0 observation is historical; the November 2 Atlas session was signed out and did not refresh that observation.
3. Deploy shared writers with `NOTEBOOK_DB_LISTING=off`. Ensure every active writer uses the shared computation and drain old writer instances. Audit schema initialization behavior before this deployment so index creation is deliberate. Do not enable the optimized reader yet.
4. Build only approved additive indexes, preserving existing ones. Verify the Hungarian collation on both indexes and queries. Confirm ready indexes and inspect `explain('executionStats')` for the DM/player, section, Sessions and shallow/deep-page matrix. Require no blocking in-memory sort; report examined documents and keys, timings and payloads separately. Treat exact counts and navigation as their own work where possible.
5. Use credentials through the environment, never command arguments. Start with a read-only full `--check`. Apply a bounded backfill with a dedicated checkpoint, resume it to completion, then perform a fresh full consistency check. The CLI invalidates readiness before apply and certifies only after a complete consistent scan. A conflicted or uncertified room stays on the legacy path. Do not reuse a completed cursor to repair unrelated older drift: use a fresh checkpoint and rescan.
6. For a canary, limit backfill/certification to the selected room and set `NOTEBOOK_DB_ROOMS` to that room ID alongside `NOTEBOOK_DB_LISTING=on`. Blank admits none; standalone `*` explicitly admits every certified room. Verify current sharing, player preview, search, session chronology, mixed alphabetical ordering and all write paths, and compare with baseline. Expand only after review.
7. Roll back the reader by setting `NOTEBOOK_DB_LISTING=off` and recycling processes; retain source data and additive metadata/indexes. If rolling writer code back to an older version, invalidate affected readiness and require a new full consistency check/certification before enabling the reader again. Do not delete indexes or rewrite prose as a rollback shortcut.

Production flag enablement, index creation, migration, certification and optimization rollout were not authorized or performed as part of the timing deployment.

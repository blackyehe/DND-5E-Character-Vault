# Request timing production preflight

Subsequent release: the corrected production package was deployed independently; see [the release and baseline-collection report](request-timing-release-2026-11-02.md). The statements below describe the earlier preflight.

No deployment was performed in this preflight.

The public alias currently points to `dpl_6mRHrAmnPJMifYWRrvzfeEvWJ5bH`, the manual Services deployment at https://dndoldal-6hncygwat-dndenjoyerstudio.vercel.app. Its metadata records no Git commit SHA. It is not the source at `9d2c605555bdb9eb364eeb60d3450a61cca218bd`: 139 input paths differ. All 422 deployed input hashes were checked against the retained `.local/loading-review-v3-20261102/source` package before preparing instrumentation. The old patch against 9d2c605 does not apply cleanly to that production package and must not be used to deploy the current application.

The corrected, production-specific patch is `.local/request-timing-production-20261102/instrumentation-production.patch`, with its complete source under the adjacent `source/` directory. Its manifest contains 423 inputs: six existing backend files contain timing-only annotations and one middleware file is added. The notebook route and schema, every frontend file, dependencies, queries, feature flags and data are unchanged from production. No derived fields, backfill or unreleased notebook optimization is included. The patch reverse-apply check passes. Backend typechecking and all four middleware tests pass against this actual production package; the earlier Git-only Owlbear type errors do not occur in this frozen production input set.

Both `REQUEST_TIMING` and `REQUEST_TIMING_SAMPLE_EVERY` are absent from the production project environment. Keep them unset: timing defaults on and every eligible request is recorded. No environment settings were mutated during preflight. A future staged/deployed request must also omit sampling overrides.

## Retention and archiving

The project/team was checked via Vercel API and is on Hobby. Vercel's current runtime-log documentation specifies one-hour retention: https://vercel.com/docs/logs/runtime#limits. A once-daily download cannot preserve the intervening day's logs.

An authenticated, read-only exporter runs at `.local/request-timing-production-20261102/export.mjs`. It queries the same paginated Observability API used by the Vercel CLI, restricted to this project, production environment, public domain and `request_timing` messages. It preserves only allow-listed timing fields; raw platform messages, paths, application identities and content are never saved. It writes UTC daily files to `.local/request-timing-logs/YYYY-MM-DD.jsonl`, deduplicates by generated request ID and uses overlapping time windows. Export checkpoints and detected gaps are recorded separately. It reports failures or excluded intervals instead of silently claiming a complete archive.

The first real export succeeded, with zero timing rows because instrumentation has not yet been deployed. A two-page synthetic export test verified pagination, duplicate suppression and exclusion of private/unrelated fields. The scheduled task **Archive request timing logs** runs every 30 minutes; its first run is 2026-11-02 01:46 UTC / 02:46 Europe/Budapest. The task depends on this environment and its authenticated Vercel session being available; gaps beyond host retention cannot be recovered, and are reported by the exporter. The schedule does not deploy or alter the website.

To summarize a daily archive:

```powershell
node scripts/summarize-request-timing.mjs .local/request-timing-logs/2026-11-02.jsonl
```

Evidence: `.local/request-timing-production-20261102/baseline.json`, `source-audit.json`, `scope.json`, `expected.json`, `log-access.json`, `preflight.json`; export state and run history are under `.local/request-timing-logs/`.

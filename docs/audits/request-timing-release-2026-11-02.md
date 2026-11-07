# Request timing production release

Published at https://dndoldal.vercel.app. The immutable timing-only deployment is `dpl_ExfrJQJhALMYa3EJyB6Wd8MupCFf`, https://dndoldal-e1oizfmqa-dndenjoyerstudio.vercel.app. Public routing was verified and the collection window began at **2026-11-02 16:09:52 UTC / 17:09:52 Europe/Budapest**.

The corrected `instrumentation-production.patch` was deployed from the isolated production-specific source, not from the dirty workspace. All 423 deployed input hashes matched its manifest. Exactly six existing backend files changed and one timing middleware was added relative to the previously live 422-file deployment, `dpl_6mRHrAmnPJMifYWRrvzfeEvWJ5bH`. Notebook query/route/schema files and all frontend inputs are unchanged. No notebook feature flag, derived field, index or backfill change was shipped. `REQUEST_TIMING` and `REQUEST_TIMING_SAMPLE_EVERY` remain unset: timing is on and every eligible request is logged. Existing Compendium runtime flags and backend region `fra1` were preserved. These manually uploaded Services deployments do not record a Git commit SHA.

## Verification

- The isolated backend typecheck, frontend production build and all four timing-wrapper tests passed.
- Hosted and public checks each compared 16 GET responses with the control release/review, including notebook DM and player-preview listings across all/journal/story-items, search, offset 360, Sessions, navigation/link targets, Compendium browse and preloading. Response contracts matched; the frontend bundle and security headers matched; an unauthenticated Compendium request remained 401. Player coverage used the DM's existing read-only player-preview mode, not a separate new player account. No content or membership was created or edited. Existing GET handlers retain their prior derived-cache maintenance behavior.
- Real staged logs confirmed DM/player attribution, search/no-search, navigation, preloads, response-byte fields, actual Mongo command timing/round trips and `sampleEvery:1`.
- The first public export saved **17 request-timing records**, including the authorization-boundary check, across eight summary groups. All four summary skip counters were zero. These are deliberately generated release-validation requests, not representative ordinary-traffic baseline measurements. No endpoint performance ranking is inferred from them.

The public validation activity window was **16:09:52.544–16:10:02.291 UTC / 17:09:52.544–17:10:02.291 Budapest**. Preserve/exclude that window when analyzing ordinary traffic. Hosted review traffic is already excluded by the exporter's canonical-public-domain filter. Future manual click-through and after-idle requests should have their own recorded timestamps. An after-idle cache miss does not by itself prove the sole cause of latency, nor prove a function cold start.

Evidence under `.local/request-timing-production-20261102/`: `release-check.json`, `local-validation.json`, `staged.json`, `deployed-audit.json`, `hosted-validation.json`, `hosted-telemetry.json`, `promotion.json`, `public-validation.json`, `initial-summary.stdout.json`, `initial-summary.stderr.json`. All retained evidence excludes credentials and response content.

## Continuous export and elapsed-time checks

The exporter now invokes the existing Vercel CLI's bounded `whoami` check before importing the API helper, allowing the CLI to renew its session. CLI account output and raw authentication errors are captured rather than logged. The exporter dynamically finds the cached CLI, performs no installation and fails explicitly if renewal is unavailable. The prior direct-token exporter could fail after token expiry. Authentication was renewed and the public export succeeded with zero reported capture gaps or excluded intervals after baseline collection began; earlier pre-deployment gaps remain in the export audit.

The existing **Archive request timing logs** task was found disabled and was re-enabled for baseline collection. Its interval remains 30 minutes, with next run **2026-11-02 16:32:40 UTC / 17:32:40 Budapest**. Its prompt now also runs the bounded `check-capture.mjs` after a successful export. No daemon or additional schedule was created. This still depends on this environment remaining available and the Vercel session remaining renewable; revocation and outages are reported failures, not silently complete collection.

Daily allow-listed telemetry is at `.local/request-timing-logs/YYYY-MM-DD.jsonl`. The collector keeps overlapping windows, pagination checks, request-ID deduplication, atomic checkpoints and export-window audit history. The health check records the first-hour request IDs locally, detects their later disappearance, and checks export-window coverage rather than assuming every quiet hour must contain website requests.

At initial verification, all 17 first-hour records were present with no missing records, no post-start capture gaps and no excluded intervals. **Real two-hour and overnight checks are pending elapsed time**, rather than claimed as passed. The two-hour threshold is **18:09:52 UTC / 19:09:52 Budapest**, first checked by the regular task at approximately **18:32:40 UTC / 19:32:40 Budapest**. The next-morning threshold is **2026-11-03 08:00 UTC / 09:00 Budapest**, first regular check at approximately **08:02:40 UTC / 09:02:40 Budapest**. Results are written to `.local/request-timing-logs/capture-health.json`; failures are reported by the scheduled task. A current failure or a post-start gap invalidates a claim of uninterrupted collection. Unit fixtures simulate elapsed two-hour retention and verify successful retention, failed coverage, pagination failure, exclusions, privacy and duplicate suppression; they are not the pending real checks.

After collecting representative traffic, summarize a daily archive directly:

```powershell
node scripts/summarize-request-timing.mjs .local/request-timing-logs/2026-11-02.jsonl
```

Stdout contains endpoint/role/search cohorts, request counts, handler and DB p50/p95/max, response-byte p50 and Compendium cache classifications/rate. Stderr contains skip counts. Investigate gaps, missing fields and unclassified caches before interpreting latency. Low-count groups do not establish typical performance. The current legacy listing shares its entry read with navigation/count derivation, so the baseline cannot independently price exact-total computation or establish a database-region cause. No database-backed timing sink or TTL index was added.

## Atlas and the separate notebook rollout gate

The backend's current deployment region is `fra1`. The October 28 read-only Atlas observation recorded Free/M0 on AWS Frankfurt. A fresh attempt on November 2 reached the Atlas sign-in page, so **current Atlas region, tier and paused state remain unverified**; no cluster settings were changed.

The separate [notebook rollout verification and runbook](notebook-rollout-verification-2026-11-02.md) records the default-off flag, per-room readiness certification, fallback, shared write computation, resumable migration and rollback checks. All 73 tests across its five focused files passed locally. No notebook optimization deployment, flag enablement, production index build, migration or certification was performed. Fresh Atlas verification and baseline results still gate that later rollout.

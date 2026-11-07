# Homebrew Workshop: derived summaries and one startup request

Sir, this change is live at https://dndoldal.vercel.app/homebrew. It addresses the five 15-second library timeouts and the separate pack-list source parsing cost.

## Release and scope

- Production deployment: `dpl_6DxQ5VUiqmDPXj8YQFBiMXsQRdki`, immutable https://dndoldal-kkbqugyzs-dndenjoyerstudio.vercel.app.
- Previous production and compatible rollback: `dpl_BY1GPpWJLCYAdJFKJSSjQXwWLhFU`, immutable https://dndoldal-dihf2h712-dndenjoyerstudio.vercel.app.
- Published just after midnight on 3 November in Budapest (2 November UTC).
- The frozen 445-file release inherits the exact [published map release](map-overview-release-2026-11-02.md). The hosted source tree was audited against every file's SHA-1. Only 16 Workshop runtime files and six relevant tests were overlaid. Unrelated dirty workspace changes and the held large-response middleware patch were excluded.
- This was a Vercel production promotion. The unrelated working tree was not committed or pushed to Git.

## Cause and change

The old pack-list endpoint loaded complete source files and parsed them to create small reports. A large library therefore incurred source transfer/decompression/parsing even when only filenames and counts were needed. The Workshop page separately launched five imported-library requests, all requiring the full authoring catalogue.

1. Validated writes now persist a versioned report with its source fingerprint. Pack listing queries only small metadata and matching reports. Legacy, stale, invalid or oversized reports retain the exact source-based fallback; warnings are never truncated. No GET request performs a backfill.
2. New `GET /api/workshop/initial` returns all five existing sections together. It reads the existing prepared class, subclass, race and spell components, which preserve complete editable definitions. Missing, stale or unavailable components use the full existing library; a partial library is never accepted.
3. A bounded per-owner resident response cache checks current metadata on every request. It retains at most four owners and 16 MiB of serialized responses. Source, filename, inclusion flags and revision changes invalidate it. Concurrent startup calls for one owner share their pending work.
4. The four old category endpoints and `/workshop/library` use the same optimized reader for older clients. The new frontend falls back to the old five requests only for an older backend's 404, never for a timeout, access failure or server error.
5. Owner-only `POST /api/content/orcbrew-packs/:id/summary` prepares one bounded legacy report. It accepts no source fields, checks source identity and size, and uses a revision-guarded update with timestamps disabled. Summary-only writes are excluded from the existing background source-change hook, avoiding a catalogue-preparation wake for every report.

All 126 existing real-owner pack summaries were prepared successfully. The post-preparation list is exactly identical to the previous 126-pack response, including reports and errors. The combined response also matches the saved old responses for all sections and source-hash membership. Original sources, source hashes, timestamps and component contexts are unchanged by report preparation; exact preservation is additionally exercised against the actual local database and hosted BOM/Unicode fixtures.

## Measurements and interpretation

Measurements cover complete response bodies and JSON decoding, not only response headers. They use the same authenticated account and exact content. Process caches are not forcibly cleared; these are finite network observations, not a guarantee of every future cold start.

Before deployment, the five concurrent library reads took 13.36–13.70 seconds; the separate 126-pack listing took 10.57 seconds. An initial comparison attempt reproduced the old deployment's 15-second timeout and was retained as a failed attempt. The measurement helper was corrected to record baseline deadlines as censored failures rather than aborting the comparison; this did not change application code.

| Six alternating review pairs | Previous five requests | New combined request |
|---|---:|---:|
| Median, complete library | 430 ms | 200 ms |
| Maximum in this cohort | 11,199 ms | 527 ms |
| Timeouts in completed cohort | 0 | 0 |

One pair had a slower new sample (527 ms versus 404 ms); the median and maximum gates passed across the full cohort. The first request to the review deployment used the prepared path and completed in 3.33 seconds. It was recorded separately from the six-pair cohort. The cached pack list's median across those six reads was 78 ms.

After promotion, two more alternating public pairs passed exact-data and timing checks: combined-library responses took 204 and 173 ms, and pack listing took 63 and 113 ms. These small public samples confirm the release is serving; they are not a separate robust estimate of tail latency.

The stronger structural indicator comes from database profiling of 126 synthetic packs through the actual old and new Express applications: source-reading aggregate queries fell from 11 to zero, while total database response bytes fell from 3,792,687 to 84,885. Both endpoints returned identical report objects. This benefit applies to a cold application process with prepared reports and does not depend on a warm in-memory source cache.

## Automated validation

- Final ordinary suite: **934 passed, 67 conditional skips**, with two workers. The isolated release's frontend build and backend types passed. An earlier unconstrained full run hit the existing five-second large-export test timeout; its focused run and final bounded-worker suite passed.
- Actual isolated HTTP/database lifecycle: seven aggregate checks over 27 requests. Covers cold summaries with profiling, full prepared startup equivalence, native publication, unauthorized/foreign-owner requests, strict bodies, repeatable preparation, exact BOM/Unicode exports, source/context/timestamp preservation, fingerprint mismatch, compressed size guard, replacement freshness and deletion. The fresh loopback database was dropped and its processes stopped.
- Hosted synthetic accounts: missing-summary preparation, owner isolation, strict bodies, exact source exports, automatic component readiness, full imported/native definitions and revisions, publication, deletion, restoration, include-disabled settings and replacement all passed. Temporary packs were removed and the original empty character/library state restored.
- Review and public Edge browser checks: exactly one `/api/workshop/initial` and none of the five old imported-library calls; all 36 classes, 300 subclasses and 102 races appear. One draft in each category opens with the expected name and complete description. No page errors or browser writes to the server. Drafts exist only in the discarded temporary browser profile. Fresh review browser readiness was 429 ms; the public browser check was 534 ms. These are page-ready observations after API verification warmed the origin.
- Public frontend entry matches the reviewed build; unauthenticated startup returns 401. The map's original image hash, metadata, pins, regions and revisions remain exact; both 1024/2048 overviews and conditional 304 reads still pass.

Early hosted-test failures were fixture errors: the replacement probe supplied a raw byte hash instead of the application's normalized source hash, and the browser probe looked for `Name` where the race form correctly labels it `Race name`. Both were corrected and the checks rerun. Promotion also required waiting for the public alias to reflect Vercel's asynchronous operation; the final alias and build were independently checked.

## Rollback and evidence

Rollback to the previous map deployment is compatible: the old reader ignores added summary metadata and still reads untouched sources. Preserve the map-aware accounting backend; do not restore the older pre-map deployment while overview assets exist.

Reproduction helpers and private evidence are in ignored `.local/workshop-summary-20261102/`: `scope.json`, `expected.json`, `audit.json`, `final-tests.log`, `types.log`, `build.log`, `http-smoke.json`, `hosted.json`, `candidate-first.json`, `summary-preparation.json`, `candidate-evidence.json`, `browser.json`, `promotion.json`, `public-smoke.json`, `public-evidence.json`, and `public-browser.json`. Saved real-owner responses and source backups remain private and uncommitted. The maintenance endpoint is owner scoped; no production database password was retrieved or required.

Automated checks establish this release's correctness and observed improvement without asking the user to perform manual release checks. They do not establish that every other site category is free of problems. In one longer browser probe, the existing idle preloader started additional Compendium category requests; that separate background-work behavior remains a useful next area to investigate if contention persists.

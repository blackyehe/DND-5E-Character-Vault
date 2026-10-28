# Creator cache and deferred sheet release — 28 October 2026

The user authorized shipping the retained creator cache, sanitized database diagnostics and the previously pushed deferred sheet tools. The Compendium entry-editor split remains excluded because it trades 276 ms faster browsing for a 621 ms slower first editor opening on the constrained profile. Hover preloading and larger database batches remain experiments, not release changes.

## Scope and release checks

The release is reconstructed from the exact current public deployment, `dpl_7FB8zBXowAKfqZt8izXd8SVFTY53`, with 17 application files overlaid. All other source hashes are preserved. No extension-authentication source, environment value, deployment configuration or infrastructure setting changes. The existing broader branch contains other work; this source manifest deliberately limits the live release.

The creator cache retains one account's bounded catalogue in IndexedDB and requires an authenticated exact-revision check before reuse. Its measured controlled repeat readiness was 3.600 → 1.443 seconds; first loads still fetch the full catalogue. The local storage and first-load costs are described in [the loading audit](loading-times-2026-10-28.md). This release is a bridge toward local browsing, not offline support.

The whole working-checkout suite passes 479 tests with 55 opt-in skips. That checkout includes unrelated unfinished extension authentication edits. Separately, the frozen release source passes its production frontend build, backend TypeScript check and all 21 focused tests across five files. No claim is made that the clean Git branch's inherited extension-test/typecheck issues are repaired by these changes.

The corrected release passed the production frontend build, backend TypeScript check, 28 focused tests and an exact 376-file hosted source audit. Authenticated checks covered first-response persistence, actual creator UI reuse of a 304 across a weak-to-strong ETag transition, sheet display, deferred character editor and item composer opening, safe composer cancellation, Compendium browse/detail reads and the game-room listing. No real character, item or room mutation was requested during these checks. Anonymous login/assets and extension Origin/auth refusals match the public baseline.

Ignored `.local/cache-release-20261028/` retains the frozen source, exact source manifest, release scope, validation logs and deployment helper. Deployment creation disables automatic domain assignment; promotion requires the matching source audit and explicit successful check record. Public alias changes are guarded against a different intervening release.

## Hosted header correction

The first isolated candidate (`dpl_Hs4SqWZQpF5kH4687Qct1rNA22Ph`, `dndoldal-6y68hqc0v-dndenjoyerstudio.vercel.app`) passed the 376-file source audit and preserved the public extension boundary (403 without Origin, 401 with an allowed extension Origin). An authenticated creator request returned the same 2,696,833 bytes and SHA-256 digest as production, but Vercel delivered a weak `W/` ETag. The original strong-only client validator consequently did not persist a catalogue. This candidate is not approved for promotion.

The correction accepts the optional uppercase `W/` transport prefix and compares the underlying exact revision identity. If-None-Match uses weak comparison under RFC 9110 section 13.1.2. Owner scope, revision derivation, payload checksum, expiry, size limits, authentication checks and account-transition protection remain required. Regression tests cover weak persistence, both strong/weak response transitions, changed hashes and malformed tags. Corrected frozen-source checks and hosted results are recorded separately under `.local/cache-release-20261028-r2/`; the initial deployment evidence remains intact.

## Live outcome

Deployment `dpl_6bpCG5upDkhHqAFApKoZhGH1vdC1` (`dndoldal-4eddcxtac-dndenjoyerstudio.vercel.app`) was promoted to `https://dndoldal.vercel.app`. The promotion returned an empty successful response, which the generic JSON API helper could not parse; an independent alias read confirmed success. No duplicate promotion was attempted. `promoted.json` records the verified result and previous deployment for recovery.

On the reviewed domain, the first creator response took 13,687 ms to headers; the initial conditional UI repeat still took 11,147 ms. Subsequent authenticated 304 requests took 404, 410, 462 and 773 ms, transferred no catalogue body, and used 320–334 ms of application time in the samples with timing headers. These are smoke observations, not controlled before/after measurements. The persisted payload matches the production baseline SHA-256 `9adb116f7e252ef19237a77ff56193163161e2c7e1f05656cf36ac3f1b8f123d` and all eight category counts.

Post-promotion, the public creator rendered without alerts and persisted the same checksum. An actual repeat UI request returned 304, but took 10,998 ms (10,739.6 ms application time; database connection readiness 0.1 ms). This establishes avoided catalogue transfer, but does not establish that the application took the cheap metadata-validation path. Subsequent [conditional-request diagnostics](conditional-cache-2026-10-28.md) found the standard request header absent at the application boundary, allowing full catalogue work before a 304. The earlier attribution to slow metadata validation was not supported by that smoke check. Do not present the warm samples as a guarantee that the 10–14 second hosted problem is solved. The public source alias, assets, anonymous login and extension boundary were also rechecked.

## Next local stage

The subsequent [creator transport correction](conditional-cache-2026-10-28.md) is now live as `dpl_3UMbRS3yLw3P8Dbbigd7Zo4aZkBL`. It changes two runtime files over this exact release, carrying the saved revision in an application header that reaches the validator. Public repeat creator checks now took 422 and 430 ms with zero catalogue-body bytes; complete creator choices appeared at 1,146 and 955 ms in those two observations. The Compendium prototype and diagnostic hooks remain outside production.

The local Compendium candidate will synchronize compact category/search metadata and retain it on the device. Full entry definitions remain on demand. Existing server browsing remains available when local storage is blocked, over budget, corrupt or unsupported. Server copies remain in place for recovery and other devices. Character writes, room permissions and the database engine remain unchanged in this first stage.

Before implementation, the expected repeat-visit opportunity is to avoid the measured category rebuild, not to improve it by a small percentage: a hosted monster miss took 11,623 ms of application time versus 488 ms on a RAM hit. Their 11,135 ms difference is an opportunity budget, not a promised local-browser saving. First synchronization still pays its real server and transfer costs, plus indexing/storage work. Measure those costs and query equivalence before retaining the candidate.

A database-engine change, including MySQL, remains a separate comparison. The current evidence establishes slow prepared-data delivery, not that a relational engine is inherently faster. Compare transfer limits, region, request count, payload size, JSON/rule storage, migration effort and hosting cost using an equivalent workload before recommending migration. No database migration or paid infrastructure action is authorized by this comparison alone.

# Creator cache and deferred sheet release — 28 October 2026

The user authorized shipping the retained creator cache, sanitized database diagnostics and the previously pushed deferred sheet tools. The Compendium entry-editor split remains excluded because it trades 276 ms faster browsing for a 621 ms slower first editor opening on the constrained profile. Hover preloading and larger database batches remain experiments, not release changes.

## Scope and release checks

The release is reconstructed from the exact current public deployment, `dpl_7FB8zBXowAKfqZt8izXd8SVFTY53`, with 17 application files overlaid. All other source hashes are preserved. No extension-authentication source, environment value, deployment configuration or infrastructure setting changes. The existing broader branch contains other work; this source manifest deliberately limits the live release.

The creator cache retains one account's bounded catalogue in IndexedDB and requires an authenticated exact-revision check before reuse. Its measured controlled repeat readiness was 3.600 → 1.443 seconds; first loads still fetch the full catalogue. The local storage and first-load costs are described in [the loading audit](loading-times-2026-10-28.md). This release is a bridge toward local browsing, not offline support.

The whole working-checkout suite passes 479 tests with 55 opt-in skips. That checkout includes unrelated unfinished extension authentication edits. Separately, the frozen release source passes its production frontend build, backend TypeScript check and all 21 focused tests across five files. No claim is made that the clean Git branch's inherited extension-test/typecheck issues are repaired by these changes.

Hosted source audit, authenticated cache verification, extension-boundary checks, promotion and post-release verification are pending at initial preparation. The earlier broader candidate's extension-initialization failure must not be carried into this release. Release progress and final deployment identifiers will be added here after observation.

Ignored `.local/cache-release-20261028/` retains the frozen source, exact source manifest, release scope, validation logs and deployment helper. Deployment creation disables automatic domain assignment; promotion requires the matching source audit and explicit successful check record. Public alias changes are guarded against a different intervening release.

## Next local stage

## Hosted header correction

The first isolated candidate (`dpl_Hs4SqWZQpF5kH4687Qct1rNA22Ph`, `dndoldal-6y68hqc0v-dndenjoyerstudio.vercel.app`) passed the 376-file source audit and preserved the public extension boundary (403 without Origin, 401 with an allowed extension Origin). An authenticated creator request returned the same 2,696,833 bytes and SHA-256 digest as production, but Vercel delivered a weak `W/` ETag. The original strong-only client validator consequently did not persist a catalogue. This candidate is not approved for promotion.

The correction accepts the optional uppercase `W/` transport prefix and compares the underlying exact revision identity. If-None-Match uses weak comparison under RFC 9110 section 13.1.2. Owner scope, revision derivation, payload checksum, expiry, size limits, authentication checks and account-transition protection remain required. Regression tests cover weak persistence, both strong/weak response transitions, changed hashes and malformed tags. Corrected frozen-source checks and hosted results are recorded separately under `.local/cache-release-20261028-r2/`; the initial deployment evidence remains intact.

The local Compendium candidate will synchronize compact category/search metadata and retain it on the device. Full entry definitions remain on demand. Existing server browsing remains available when local storage is blocked, over budget, corrupt or unsupported. Server copies remain in place for recovery and other devices. Character writes, room permissions and the database engine remain unchanged in this first stage.

Before implementation, the expected repeat-visit opportunity is to avoid the measured category rebuild, not to improve it by a small percentage: a hosted monster miss took 11,623 ms of application time versus 488 ms on a RAM hit. Their 11,135 ms difference is an opportunity budget, not a promised local-browser saving. First synchronization still pays its real server and transfer costs, plus indexing/storage work. Measure those costs and query equivalence before retaining the candidate.

A database-engine change, including MySQL, remains a separate comparison. The current evidence establishes slow prepared-data delivery, not that a relational engine is inherently faster. Compare transfer limits, region, request count, payload size, JSON/rule storage, migration effort and hosting cost using an equivalent workload before recommending migration. No database migration or paid infrastructure action is authorized by this comparison alone.

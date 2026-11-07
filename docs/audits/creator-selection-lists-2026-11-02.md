# Creator selection-list loading - 2 November 2026

Published and publicly verified; release details are recorded below. Public baseline remains dpl_DrPd5jzRBe7HhLXoavzdPV9QgpQy / a28aa85. Final review: dpl_6mRHrAmnPJMifYWRrvzfeEvWJ5bH, https://dndoldal-6hncygwat-dndenjoyerstudio.vercel.app.

## Priority and measured trigger

Fresh isolated desktop Edge traces of the real account showed first creator loading waiting on standard classes, races, backgrounds, equipment and languages lists. Some individual list requests exceeded two seconds. The first sheet opening also waited for reference and class-level lookups. Requests were read-only, server caches were retained, browser storage was fresh per view, and background search-index transfers were excluded to isolate these opening paths. These observations are not a controlled cold-start comparison.

## Small retained change

The creator and other callers of the five standard selection lists now share one lazily fetched, build-versioned JSON asset. It contains 12 classes, 9 races, 1 background, 16 languages and 237 equipment references: only index, name and URL. The complete order and values match the current live endpoints. The source is the same pinned public SRD snapshot already used by the server. The existing update-compendium-index script regenerates the frontend lists alongside the server index.

The emitted asset is 22,743 bytes, 4,171 bytes gzip. It is separate from initial HTML and fetched only when a selection list is needed. Calls share the same promise; failures fall back to the existing SRD API. Full definitions, imported content, personal changes and authoritative validation keep their existing paths. No new database/cache layer or dependency. The fallback uses the existing API timeout and can take longer when the asset request itself stalls; normal operation removes the five metadata API calls from startup.

A normal fetch is used for this optional data asset so a failed asset download does not generate a route-code recovery notice.

## Release review findings

The earlier optional navigation-code warming prototype was held after a synthetic hosted failure reproduced a misleading current-page reload notice. Its original source is preserved under .local/loading-review-20261102/held-navigation-warmup/. Published files were restored in the working checkout; no global error-handler rewrite was introduced. The earlier loading-followups audit describes the prototype before this review decision.

Hover/focus priority and bounded preload persistence remain retained. They pass hosted tests, including reuse in a new tab of an unopened prepared entry.

## Validation and observed limits

- 82 focused tests across nine files pass; production frontend build/type checking and backend type checking pass.
- Final hosted source audit matches 422 inputs, seven runtime changes relative to the live baseline. Owlbear authentication remains excluded.
- Ten protected endpoints/security/header checks and seven read-only real-library response/access checks pass.
- Synthetic Edge checks pass for hover/focus ordering, persistent new-tab reuse, normal creator startup, and failed data-asset fallback without missing choices or a misleading reload prompt. No page errors.
- The real-library creator in the final review showed its shell at 348 ms and its library ready at 670 ms. Only auth (68 ms) and imported creation-options (363 ms) appeared in that startup API trace; the five standard-list API calls were absent.
- The sampled real sheet showed its shell at 980 ms and references ready at 2,023 ms. The remaining reference request was 563 ms and the standard selected-class levels request 502 ms. These are single observations with retained server caches; do not advertise the earlier 4.2-second public observation against 670 ms as a guaranteed speedup.

The next candidate is the remaining sequential selected-class/reference work on sheet opening. Measure/overlap only what remains correct if resolved character rules change; no broader cache architecture is justified yet.

Evidence: .local/public-selection-lists-20261102/ and .local/loading-review-v3-20261102/. Earlier review deployments under loading-review and loading-review-v2 are superseded and were never promoted. No real characters, imported packs or rooms were written. No production alias change or Git commit/push in this task.

## Published release

Published and publicly verified: dpl_6mRHrAmnPJMifYWRrvzfeEvWJ5bH, https://dndoldal.vercel.app. Rollback: dpl_DrPd5jzRBe7HhLXoavzdPV9QgpQy. Earlier local-only descriptions are historical. Navigation-code warming remains held; hover/focus detail priority, bounded persistent preloads and the lazy public selection lists are included.

The immutable source audit matches 422 inputs with seven runtime changes. Existing 82-test, build/type, exact public-list equality and hosted evidence was reused for unchanged source. Public HTTP/security, real-library response/access, desktop hover/focus and cross-tab cache, creator normal/failure fallback, and read-only character/creator opening checks passed. The real creator used the new startup path without the five standard-list API calls. Isolated browser contexts were closed; no real characters, packs or rooms were written.

The first promotion attempt rolled back after receiving the old public bundle. Two retry attempts also rolled back because the retry probe omitted protection-bypass headers when reading the reviewed URL and therefore selected the wrong reference bundle. The corrected probe verifies the application shell with the same review-access headers as the original hosted checks. The successful promotion matched the exact reviewed public bundle immediately and passed every public check. No check was relaxed. Attempt evidence is retained under .local/loading-review-v3-20261102/.

No general live latency saving is claimed. Owlbear authentication remains excluded.

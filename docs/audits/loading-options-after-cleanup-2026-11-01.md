# Loading options after the cleanup release - 1 November 2026

Lightweight research only: no implementation, deployment, cache clearing or new benchmark. Baseline: live cleanup/armour release dpl_DrPd5jzRBe7HhLXoavzdPV9QgpQy, Git a28aa85.

Already shipped: automatic device search indexes, automatic server pack preparation, opened-entry persistence, visible-page detail preloading, metadata batching, combined foreground source-cache lookup, and reduced repeated character calculations. Do not propose these again as new work.

Recommended shortlist:

1. Prioritize hover/keyboard focus within the existing visible-page preload queue. Reorder eligible waiting entries after a short intent delay, retain the page/request/byte caps and click priority, and avoid cancelling an active batch merely because the pointer moved. Helps an entry clicked before the rest of the page has warmed; does not accelerate an already warm read. This is the smallest useful experiment.
2. Investigate a cheaper freshness stamp. Detail validation currently derives a library revision from pack/item/edit metadata. A small owner/category generation record could make checks cheaper, but every import/edit/delete/include-disabled/enrichment path must invalidate it correctly. Preserve before/after consistency checks, authorization and legacy fallback. This has more potential for server-bound clicks and more implementation risk; measure current validation cost first.
3. Persist a bounded amount of preloaded full-detail data, rather than only values actually opened. Current optional preload warms memory; a normal open persists an entry. Could help browser/tab restarts and unopened entries on revisited pages. Reuse existing owner/revision/digest checks and storage caps, batch writes carefully, and measure disk contention. Does not solve the first-ever download or guarantee offline/current rules.
4. Warm a likely destination's lazy JavaScript on navigation intent or quiet dashboard time. Useful for first creator/sheet/Compendium navigation if code transfer is material. Bound the work to a likely destination and yield to active requests. Measure transfer first; route code is already split.

More speculative: display saved Compendium text immediately while validating in the background. This is the stale-while-revalidate pattern. It deliberately permits briefly old content. It is not recommended as the default for character, room or authoritative rule actions; those need fresh authorization and rules. A reader-only version would need an explicit freshness indicator and separate assessment.

Other systems' patterns, not dependencies we need to install:

- Next.js prefetching: https://nextjs.org/docs/app/guides/prefetching
- TanStack Query cached data and background refresh: https://tanstack.com/query/latest/docs/framework/react/guides/caching
- Stale-while-revalidate behavior and tradeoff: https://web.dev/articles/stale-while-revalidate

No incremental millisecond saving is established for these candidates. The earlier observations suggest server waits deserve attention; that is a prioritization inference, not a fresh performance measurement. Prefer one small same-account comparison against the current release before implementation grows. A database replacement, larger unrestricted preload batches or downloading every full pack is not justified by this research pass.

Follow-up: [2 November implementation and measurements](loading-followups-2026-11-02.md). Intent priority, bounded persistent preloads and code warming are retained locally; a new freshness-stamp system was deferred after current measurements.

Review update: [Creator startup investigation and final retained scope](creator-selection-lists-2026-11-02.md). Optional navigation-code warming is held because failed warmups can show a misleading reload notice. Hover/focus priority and bounded persistent preloads remain retained; the creator now also uses a small pinned public selection-list asset. These changes are not live.

## Published release

Published and publicly verified: dpl_6mRHrAmnPJMifYWRrvzfeEvWJ5bH, https://dndoldal.vercel.app. Rollback: dpl_DrPd5jzRBe7HhLXoavzdPV9QgpQy. Earlier local-only descriptions are historical. Navigation-code warming remains held; hover/focus detail priority, bounded persistent preloads and the lazy public selection lists are included.

The immutable source audit matches 422 inputs with seven runtime changes. Existing 82-test, build/type, exact public-list equality and hosted evidence was reused for unchanged source. Public HTTP/security, real-library response/access, desktop hover/focus and cross-tab cache, creator normal/failure fallback, and read-only character/creator opening checks passed. The real creator used the new startup path without the five standard-list API calls. Isolated browser contexts were closed; no real characters, packs or rooms were written.

The first promotion attempt rolled back after receiving the old public bundle. Two retry attempts also rolled back because the retry probe omitted protection-bypass headers when reading the reviewed URL and therefore selected the wrong reference bundle. The corrected probe verifies the application shell with the same review-access headers as the original hosted checks. The successful promotion matched the exact reviewed public bundle immediately and passed every public check. No check was relaxed. Attempt evidence is retained under .local/loading-review-v3-20261102/.

No general live latency saving is claimed. Owlbear authentication remains excluded.

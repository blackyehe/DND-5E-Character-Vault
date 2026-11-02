# Loading follow-ups - 2 November 2026

Local, uncommitted and not deployed. Baseline: public release dpl_DrPd5jzRBe7HhLXoavzdPV9QgpQy, commit a28aa85. No dependencies, database schemas, authoritative rule calculations or held Owlbear authentication changed.

## Retained changes

- The existing detail queue accepts sustained mouse or keyboard intent after 180 ms. It brings that visible default version forward and can start its existing batch before the ordinary idle delay. It adds no entries or download budget and does not interrupt a running batch. Brief crossings, blur, page/account replacement, pause and disposal clear pending intent. Click priority remains intact.
- Verified full-detail preloads now save small batches in the existing IndexedDB store. Each transaction scans the cache once, preserving owner/revision/digest checks and the 200-entry, 16 MiB, seven-day caps. Mixed owners, duplicate keys and oversized batches/rows are rejected. Disk saves do not delay the next network batch and are cancelled on foreground work; account/library invalidation still cancels transactions. Optional or interrupted persistence can fall back to a later normal opening. Automatically saved entries share the existing budget and may evict older entries.
- The installed Vue Router loadRouteLocation helper warms lazy code for Compendium, creator and character-sheet controls after intent. It does not navigate, run guards, mount the view or fetch private view data. At most one warmup import is in flight across controls. Pending intent is cancelled on leave/blur/unmount; work is skipped when hidden, offline or foreground-busy. Import failures permit normal retries. An import already started cannot be aborted, so an unused hover can download unused code and dependencies. No timed background warming or new polling.

## Measured and deferred

Read-only live requests using the existing authenticated session sampled three imported spells and three imported classes, with existing server caches retained. Six freshness endpoint reads had a median of 50 ms, range 44-87 ms. These are warm API measurements from this environment, not database profiling, user-browser click times or a cold-start guarantee. They do not justify a new owner/category version-record system and its invalidation obligations across every writer. Existing before/after consistency checks remain unchanged.

The actual-adapter Edge storage probe used isolated synthetic contexts. With 200 existing 16 KiB rows, saving 25 new 2 KiB rows through the previous single-write path took 451 ms; candidate batches of at most three took 162 ms. Both retained all new rows within the same count cap. Largest timer gaps were 21/17 ms. Empty-store observations were 28/11 ms. This single controlled feasibility comparison establishes fewer full-cache scans, not a page-opening speedup or user-device guarantee. No general live latency saving is claimed.

## Verification

61 focused tests across five files pass, covering queue bounds/order/cancellation, storage limits/ownership/abort, persistent reuse, click priority, route warming and normal guards after warming. Production frontend build/type checking and backend type checking pass.

The actual built application passes desktop Edge tests with synthetic API fixtures: hover/focus priority, warm clicks without a full-detail request, reuse of an unopened preloaded entry in a new tab, and code arriving before navigation while private view data waits for navigation. No page errors. No full-library replay or broad benchmark was repeated.

Evidence and reversible backups: .local/loading-followups-20261102/. The task preview server and isolated browser contexts were closed. A hosted review remains necessary before release.

Review update: [Creator startup investigation and final retained scope](creator-selection-lists-2026-11-02.md). Optional navigation-code warming is held because failed warmups can show a misleading reload notice. Hover/focus priority and bounded persistent preloads remain retained; the creator now also uses a small pinned public selection-list asset. These changes are not live.

## Published release

Published and publicly verified: dpl_6mRHrAmnPJMifYWRrvzfeEvWJ5bH, https://dndoldal.vercel.app. Rollback: dpl_DrPd5jzRBe7HhLXoavzdPV9QgpQy. Earlier local-only descriptions are historical. Navigation-code warming remains held; hover/focus detail priority, bounded persistent preloads and the lazy public selection lists are included.

The immutable source audit matches 422 inputs with seven runtime changes. Existing 82-test, build/type, exact public-list equality and hosted evidence was reused for unchanged source. Public HTTP/security, real-library response/access, desktop hover/focus and cross-tab cache, creator normal/failure fallback, and read-only character/creator opening checks passed. The real creator used the new startup path without the five standard-list API calls. Isolated browser contexts were closed; no real characters, packs or rooms were written.

The first promotion attempt rolled back after receiving the old public bundle. Two retry attempts also rolled back because the retry probe omitted protection-bypass headers when reading the reviewed URL and therefore selected the wrong reference bundle. The corrected probe verifies the application shell with the same review-access headers as the original hosted checks. The successful promotion matched the exact reviewed public bundle immediately and passed every public check. No check was relaxed. Attempt evidence is retained under .local/loading-review-v3-20261102/.

No general live latency saving is claimed. Owlbear authentication remains excluded.

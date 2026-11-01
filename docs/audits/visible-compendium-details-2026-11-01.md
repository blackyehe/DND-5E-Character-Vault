# Visible-page Compendium details - verified release, 1 November 2026

Published and publicly verified at https://dndoldal.vercel.app. Live: `dpl_HanC2oYaQWa2ewDE72eTK1PXiLDa`; rollback: `dpl_6fm5k6C6Ad6ArkMw77cp73Bt1ijA`. Reviewed immutable URL: https://dndoldal-cujo2v2z8-dndenjoyerstudio.vercel.app. This release includes the retained metadata-batching improvement and visible-page detail preloading. It does not repeat automatic server pack preparation or existing opened-entry persistence.

## Actual library measurements

Existing caches were retained; these are observations, not cold-load guarantees. The signed-in production baseline returned the 25 default spell details sequentially in 16.16 seconds, with individual reads between 373 and 834 ms and about 62 KiB of JSON. That baseline used the shared browser, whereas the subsequent review/public checks used desktop Edge, so it is not a controlled network-equivalent speedup comparison.

The first review was withheld: its first 21 spell values arrived within about 4.2 seconds, but background index work competed for the same idle lock and delayed the full page to 23.9 seconds. The correction gives visible-page details priority over category-index checks within the active view. Clicks remain first. The device status explains this temporary pause and indexes resume automatically afterward.

| Actual public-site check | Observed result |
| --- | ---: |
| All 25 displayed spell details ready | 8.39 s |
| All 18 displayed class details ready | 3.42 s |
| Click on a preloaded spell/class | 21 / 60 ms |
| Full-detail requests for those warm clicks | 0 |
| Click during an interrupted preload | 342 ms |
| Preloading resumed after foreground completion | 908 ms |

All remaining values finished after the interrupted click; no new detail batch started during that foreground request. The priority test deliberately delayed one batch response by 2.4 seconds to prove a click does not wait for slow siblings. Its remaining requests use actual hosted data and normal network conditions. The corrected review also passed, with 25 spells in 15.36 seconds, 18 classes in 7.29 seconds, an interrupted click in 856 ms and resumption in 918 ms. Variation across these observed runs is material; no fixed latency is promised.

The public spell page used nine background requests and roughly 60 KiB of returned JSON; the class page used six requests and roughly 191 KiB. This is extra work when entries are never opened. Preloading hides some first-click waiting after values arrive; it does not make initial search rendering or conversion intrinsically faster. Earlier synthetic timing demonstrations are retained in ignored local evidence and are not presented as live performance savings.

## Behavior and limits

- Queue only the displayed/default version of up to 25 families after a completed search, filter or page change. Other versions remain available on selection.
- Wait 900 ms for idle; process one batch of at most three entries, with 350 ms gaps. Use the existing cross-tab idle-work lock. Visible details temporarily pause the active view's category-index maintenance; hidden/offline tabs, rooms, editing and foreground work still take priority.
- A click can join an almost-finished batch for at most 120 ms. Otherwise cancel it and dispatch the normal detail request. Some cancelled server work may finish within its own bounds; clicks never wait for the whole page. Resume remaining entries after idle.
- At most 256 KiB per decoded entry, 512 KiB per batch body and 2 MiB of completed decoded response bodies per page. The page cap includes detail-revision responses but not total database traffic or HTTP overhead. Allow at most 16 attempts including interruptions; stop after two failed batches until another page/search.
- Check a six-second soft server budget between entries; this is not a hard invocation deadline. Prepared reads keep their bounded queries. Optional upstream rules use low-priority scheduling, a four-second deadline, one attempt and a bounded response reader. The client abandons a batch after twelve seconds.
- Background reads use current owned prepared components/caches and stable before/after revisions, including personal editions and monster enrichment. They do not parse raw source packs, rebuild an index or fall back to a full library rebuild. Defer unavailable, oversized or unverifiable legacy values to a normal click.
- Warm the existing bounded memory cache; unopened preloads do not write IndexedDB. Opening persists through the existing owner/revision/digest checks. Memory remains capped at 4 MiB estimated string storage, with its count cap raised from 20 to 32. Existing disk limits and cache format remain unchanged.
- Cancel stale queues on search/page/account changes and view disposal. Late batches cannot override newer foreground authorization. Room/player responses are never placed in this personal cache. Per-entry change tracking remains a separate possible improvement; broader revision checks remain intact.

## Validation and source scope

All 763 website tests pass, with 60 existing/opt-in skips. Frontend/server types and the production build pass. Added priority tests prove index checks resume after visible details, while clicks retain first priority. The local real-Express/MongoDB fixture passes authentication, foreign-owner isolation, complete foreground equality, personal editions and deleted-source checks; its guarded database was removed. No raw-source aggregates were made during prepared batch reads.

The first review passed 11 owner/editor/player and room checks with active synthetic fixtures cleaned. Their server/shared runtime is byte-identical in the corrected review; these results were explicitly reused, not relabelled as a rerun. The corrected build separately passes protected HTTP/security and Owlbear boundary checks, ten read-only standard-rule/API/desktop checks, and actual-library page/click/resumption checks. Immediate public HTTP, actual-library and rule checks pass. No rollback was required.

Exact deployed source audit: 421 runtime input files, twelve changed/added against the prior public release. Git retains its previously documented README-only difference from the frozen live package. No dependencies, database/billing settings, authentication rules or room-write behavior changed. Original unrelated dirty work, especially unfinished Owlbear remembered login, remains separate.

Evidence: `.local/visible-preload-release-v2-20261101/` (source manifest/audit, 763-test report, real/public measurements, reuse proof, promotion and live records). Earlier withheld review: `.local/visible-preload-release-20261101/`. Local fixtures: `.local/visible-detail-preload-20261101/`. Private session/profile files and pack content remain ignored and must never be committed.

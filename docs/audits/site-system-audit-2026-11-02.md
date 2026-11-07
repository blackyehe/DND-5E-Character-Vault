# Site systems and opening-time audit — 2 November 2026

Map follow-up: [Full-quality delivery alternatives and repeated measurements](map-delivery-alternatives-2026-11-02.md) shows that the unchanged image can transfer in under 0.6 seconds, with much slower later observations. The 8.690-second value below is a single observation, not a worst-case bound or proof that reducing image quality is necessary.

Sir, the audit reproduced a substantial uncached map wait and an actual Homebrew Workshop loading failure. The strongest immediate targets are map image delivery, Workshop source reconstruction, and the creator's oversized startup response. No performance change has been deployed.

## Scope and method

- Live: the existing signed-in account on https://dndoldal.vercel.app, desktop browser, 117 navigation/readiness observations. This includes repeated or excluded observations, not 117 independent successful scenarios. No authenticated production POST/PATCH/PUT/DELETE requests were made; the instrumented mutation count is zero. Ordinary device-cache and preference changes by the UI still occur.
- Every Compendium category and populated representative readers; every notebook category available to DM/player preview; maps and linked notes; all ten creator steps; all eight available sections on one Wizard sheet; Workshop rules/options/items/monsters/actions/embedded Compendium/trash surfaces. The embedded Compendium switch is covered by the same component's complete category checks, rather than a separate full replay.
- Local current source: 876 ordinary tests pass across 119 files. All 12 pack-preparation integration tests and all 51 Owlbear lifecycle/remembered-connection tests also pass with explicit isolated fixtures: 939 distinct tests passed overall. Four optional tests remain unexecuted: two CPU benchmark runners and two full/external-library import fixtures. The remembered-connection tests cover local prototype code, not a claim that the feature is enabled in production.
- An additional 68-check HTTP smoke run uses the actual current Express app and a new loopback-only Mongo replica set: registration/login/logout, character creation/read/isolation, room join/assignment/revocation, notebook create/edit/conflict/history/delete/recover, city create/edit/player filtering/denied write/undo/remove, map upload/read/image/304/pins/move/denied write/regions/sharing/delete/quota restoration, pack import/list/exact-byte export/isolation/delete, and Workshop/options/items/monster/trash/backup reads. Synthetic databases were dropped and helper processes stopped. No production fixture writes were needed.
- Retained 3,600-entry Mongo notebook permission/fallback checks pass, including assignment/ownership/membership revocation, hidden counts, exact pagination, multikey counts, flag-off fallback and missing/old/missing-row metadata. This tests the local optimized candidate; it is not evidence that that reader is live.
- Production frontend build and frontend/backend type checking pass. The workspace had extensive unrelated changes before this task; these have been preserved. Local code and production are different cohorts and are not interchangeable evidence.

## Findings, ordered by impact

### 1. Maps: the uncached image transfer reproduces a long wait

The real map image is 3,072 × 4,096 pixels and 2,776,932 bytes. A forced network read of its existing authorized image endpoint returned HTTP 200 in **8.690 seconds**: **1.284 seconds to headers plus 7.407 seconds reading the body**. This is a single uncached HTTP observation on this environment's connection, not a complete cold page-to-decoded-map measurement or a population percentile.

Four decoded UI openings with browser image reuse were **1.437, 1.260, 0.781 and 0.753 seconds**. The first observed reused image had only 300 transferred bytes in Resource Timing, despite its decoded/encoded representation being 2.78 MB. Thus warm cached opens must not be presented as cold downloads. Metadata and image already start together; adding Promise.all is not a missing fix.

The component waits for both metadata and the entire image Blob before showing the map. The image accounts for the long observed cold transfer; its exact network/platform cause is not isolated. Metadata/image headers also take hundreds of milliseconds to more than one second. Existing read retries and 15/20-second deadlines handle selected temporary failures, but do not make healthy slow transfers faster.

Potential fixes:

1. Provide a smaller authorized initial image or thumbnail, retain the full-quality asset for zoom, and show the map shell/progress as soon as metadata is ready. Preserve normalized pin coordinates, region geometry, fit behavior and image quality at zoom. Re-measure uncached bytes and first decoded view on the same connection.
2. Profile map access/context, map metadata, asset lookup and response transfer separately. The image endpoint currently reads room/character context and a complete map document even for cached-image access checks. Narrow projections are a candidate; never skip access revalidation or allow a 304 after revocation.
3. Replace the DM pin picker's two broad notebook listing requests with a bounded purpose-specific search, or defer it until needed. In the observed opening these start after the image is ready, so they are extra work rather than the cause of the initial image wait. Local legacy listings reconstruct metadata before slicing; repeated full navigation/search work grows with the notebook.

### 2. Homebrew Workshop: reproducible 15-second request failures

On initial Workshop opening, all five authenticated imported-library requests hit their 15-second client deadline: classes, subclasses, spells, races and Workshop library. The UI correctly reported that part of the content library could not load, but no imported classes were usable in that failed state. The neighboring pack-list request also hit its deadline. These are actual API timeouts, separate from any incorrect automation readiness selector.

A subsequent serial full-response probe found **126 pack summaries / 54,820 bytes taking 11.522 seconds**, followed by classes **0.783 seconds / 423,708 bytes** and Workshop library **0.760 seconds / 47,617 bytes**. A normal Reload library recovered fully, but took **13.627 seconds**; its race request alone took **11.942 seconds to headers**. These are different cache/request cohorts, not a controlled serial-versus-parallel experiment.

Code confirms that GET /content/orcbrew-packs reads source documents and invokes parsedPack for every summary. Small response size does not mean a cheap backend operation. Workshop startup launches multiple endpoints that can each need full-library assembly. Workshop's in-flight cache is process-local and cannot coalesce work across separate hosted instances. These mechanisms are confirmed; their individual share of the live delay still needs handler/DB tracing.

Potential fixes:

1. Persist small derived pack reports on upload/replacement, keyed by owner, source hash, parser version and relevant settings. List metadata without rereading/reparsing every original source. Retain bounded fallback/repair for legacy or invalid packs and exact-byte source export.
2. Reuse prepared or category-specific data for Workshop lists, and load editor dependencies when the corresponding section needs them. Keep an owner/revision check before cache reuse; an instance-local Promise is not a shared cache.
3. Render successfully loaded sections incrementally instead of gating the whole library on Promise.allSettled. A slower optional race/spell list should not prevent editing already loaded classes. Keep explicit failure/retry states.
4. Extend fixed-name timing coverage to content/creation/Workshop/map endpoints; current structured timing middleware mainly covers notebook and Compendium. Do not treat increasing the timeout as the primary fix.

### 3. Creator: 2.70 MB of startup JSON and delayed route assets

The initial creator opening took **9.781 seconds** in this session. Its creation-options request returned **2,696,833 decoded bytes / 417,930 encoded bytes**, taking **5.614 seconds**: 2.204 seconds to headers and 3.409 seconds to transfer the body. The creator route JavaScript took about **4.017 seconds** to arrive before that request began. Asset delivery, API response size and API processing are separate contributors; the whole wait cannot be assigned to MongoDB.

All ten creator sections worked after startup and switched in approximately 0.12 seconds under the polling measurement floor, without extra API requests. This was section navigation on an unconfigured draft, not an exhaustive build of every race/class combination or a saved production character.

Potential fix: send small identity/selection lists first, then load full selected race/class/subclass/feature definitions on demand. Preserve content identity, source/version choices, manual choices, rule calculations and draft restoration. Measure raw/encoded bytes and functional readiness, not just request count.

### 4. Compendium: freshness fallback plus first-route delivery

Initial spell results became ready in **7.831 seconds**. Its lazy route JavaScript resource took **4.446 seconds**. The local-revision request then aborted at **1.506 seconds**, matching queryLocalCompendium's 1,500 ms local attempt budget, and the normal server browse fallback took **1.775 seconds to headers**. The client suppresses further local attempts for 30 seconds after this timeout, so several following categories used server reads. This protects against an indefinitely slow cache attempt but can impose validation-plus-fallback waits. Downloaded device categories still require current owner/revision validation.

All 15 browse categories loaded. Fourteen were populated and their representative readers opened without visible errors; Other reference was empty for this account, so no real reader existed to open there. Homebrew files is the additional non-browse category and shares the pack-summary problem above. Memory/device-ready list switches reached the roughly 0.10–0.13-second observation floor; populated first category reads often took 1.2–2.3 seconds. Representative cached/persisted reader opens still made freshness/saved-detail calls, taking 0.64–1.98 seconds here; cached definitions do not guarantee zero network waits.

Potential fixes: measure and coalesce scoped freshness checks, avoid paying the same failed local preparation path across navigation, prioritize clicked/visible definitions, and inspect per-request DB counts. Preserve owner/revision/digest checks. Do not serve unvalidated private data or simply extend the timeout. Earlier route-warming work was explicitly held for recovery behavior; do not reactivate it without that regression check.

### 5. Notebook: player startup waterfall, variable category reads and known rollout limits

DM category changes ranged **0.641–2.531 seconds** in the first pass. Player-preview startup including supporting calls took **6.548 seconds**: listing started first, while link-target loading started after its response and took **4.729 seconds**. Player category actions ranged **1.824–6.426 seconds**, sometimes including periodic room/sheet/notebook refresh reads. These are action/supporting-request timings, not pure query execution times. No private-content leak or failed listing was observed.

The local notebook startup work already overlaps supporting reads and has an indexed reader/navigation split, but it remains separate from the live code. Earlier controlled evidence also shows extra first-load DB phases can lose under high RTT, and three filtered query plans retain SORT. Recommended next step is an isolated release of the verified startup changes and further first-load/query-plan validation under the existing rollout runbook, rather than blindly enabling NOTEBOOK_DB_LISTING. Production indexes, certification, backfill and write cost were not changed or freshly certified here.

Notebook entry, history, connections and focus reading worked in player preview. DM and player counts differed as expected; player preview offered no New entry control and no Trash category. The live room has no enabled map-linked city library, so actual city mutations/filtering/undo were verified only in the isolated current-source HTTP run.

### 6. Smaller UI and validation issues

- Player-preview maps displayed “Drag a pin to move it. Changes save when you drop.” despite denying pin edits. Corrected locally to a read-only instruction; DM wording is preserved.
- A backend type-check failure came from an outdated readiness test configuration using gameSessions instead of the required rememberedConnections field. Corrected the fixture to rememberedConnections:false; no extension permissions or runtime authentication behavior changed.
- One browser error, “ResizeObserver loop completed with undelivered notifications.”, occurred during the player-view layout switch. No crash or lasting broken layout was observed. Reproduction was not repeated enough to attribute it to one observer; retain as a low-priority layout investigation, not a proven map-network cause.
- No new saved-character arithmetic or data-loss defect was established. A pre-existing rule-review banner is a normal reconciliation state, not by itself proof of an error.

## Fresh category timing matrix

Times are seconds from scripted UI action to a checked readiness condition with roughly 50 ms sampling and two matching checks. Values around 0.10–0.13 seconds are a measurement floor, not exact render latency. Each row is one observation. Background polling and server/browser caches were retained, versions were not alternated, and network conditions varied. No p95, before/after speedup, cold-start proof or mobile guarantee is claimed.

### DM notebook

| Category | Seconds | Rendered entries | Requests started during action |
| --- | ---: | ---: | ---: |
| All entries | 0.742 | 60 | 1 |
| People | 2.531 | 43 | 1 |
| Places | 0.641 | 13 | 1 |
| Objects & clues | 0.734 | 11 | 1 |
| Groups | 1.077 | 2 | 1 |
| Quests | 1.509 | 2 | 3 |
| Events | 0.782 | 7 | 1 |
| Sessions | 0.770 | 13 | 2 |
| Bookmarks | 0.706 | 0 | 1 |
| Recently deleted | 1.717 | 1 | 2 |

### Player-preview notebook

| Category | Seconds | Rendered entries | Requests started during action |
| --- | ---: | ---: | ---: |
| preview | 6.548 | — | 3 |
| People | 6.426 | 32 | 3 |
| Places | 2.362 | 9 | 1 |
| Objects & clues | 1.947 | 6 | 1 |
| Groups | 2.062 | 2 | 1 |
| Quests | 4.003 | 2 | 2 |
| Events | 2.185 | 7 | 1 |
| Sessions | 6.273 | 12 | 3 |
| Bookmarks | 1.824 | 0 | 1 |

### Compendium category lists, first pass

| Category | Seconds | Rendered groups | Requests started during action |
| --- | ---: | ---: | ---: |
| Spells | 0.117 | 25 | 0 |
| Normal items | 2.282 | 25 | 1 |
| Magic items | 1.799 | 25 | 1 |
| Classes | 1.972 | 18 | 1 |
| Subclasses | 2.109 | 25 | 1 |
| Races | 1.440 | 25 | 1 |
| Subraces | 1.226 | 25 | 1 |
| Monsters | 1.539 | 25 | 1 |
| Backgrounds | 1.020 | 25 | 0 |
| Feats | 0.125 | 25 | 0 |
| Invocations | 0.125 | 25 | 0 |
| Boons | 0.126 | 1 | 0 |
| Selections | 0.126 | 25 | 0 |
| Languages | 0.104 | 25 | 0 |
| Other reference | 0.114 | 0 | 0 |

### Representative Compendium readers

| Category | Seconds | — | Requests started during action |
| --- | ---: | ---: | ---: |
| Spells | 0.837 | — | 1 |
| Normal items | 0.961 | — | 1 |
| Magic items | 1.010 | — | 1 |
| Classes | 1.319 | — | 1 |
| Subclasses | 1.716 | — | 1 |
| Races | 1.976 | — | 1 |
| Subraces | 1.932 | — | 1 |
| Monsters | 0.774 | — | 1 |
| Backgrounds | 1.154 | — | 1 |
| Feats | 0.643 | — | 1 |
| Invocations | 1.267 | — | 1 |
| Boons | 1.456 | — | 1 |
| Selections | 1.791 | — | 1 |
| Languages | 1.700 | — | 1 |

## Verification, evidence and limits

- Final ordinary suite: 876 passed, 0 failed, 67 skipped; 63 of those skipped tests were executed successfully in the separate integration runs. The initial unrestricted test run had one 5-second large-import test timeout while both compilers also ran; that file passed alone, and the full suite passed with maxWorkers=4. No assertion or timeout was relaxed.
- The first pack integration attempt enabled preparation without enabling/allowlisting the prepared reader. It correctly remained off and failed those fixture assumptions. The final run supplied both documented switches and allowlist, passed all 12 tests, and cleaned its isolated database. This is a harness correction, not a repaired production bug.
- Two automation readiness selectors referenced nonexistent text/classes; a hidden-map click also used the wrong room section. All affected attempts are excluded from timing conclusions. Eight explicit timing exclusions and the original observations are retained. API deadlines in the Workshop are independently recorded actual failures, not selector failures.
- Only the map hint and readiness test fixture changed in application/test source for this task. No deployment, production flag/index/migration, map image replacement, account content change or external message was performed. The map hint was compiler/build-verified locally; the unchanged live page still shows the old wording until a release.
- Evidence: .local/system-audit-20261102/browser.json, resources.json, opening-times.csv, timing-exclusions.json, vitest-final.json, pack-integration-configured.json, lifecycle-tests.json, http-smoke.json, corresponding cleanup records and build-final.log. These new reports omit account IDs, note text and credentials. Helper fixtures contain synthetic data only.
- This is a broad system audit, not exhaustive proof of every combination of browser/device, imported rule, concurrency pattern, write operation and production deployment. Real player-account end-to-end checks use DM preview plus isolated player accounts; production player credentials and production writes were not exercised. City libraries, remembered connections and recovery writes were tested locally where explicitly stated.

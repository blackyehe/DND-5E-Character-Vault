# Site audit — 3 November 2026

The audit confirmed three defects. Following explicit release authorization, all three fixes were deployed to https://dndoldal.vercel.app on 3 November 2026 as `dpl_YNitYq56a73VDeBKNy5j5G1cDiHC`. Hosted and public API/browser checks passed. The release starts from the exact prior published source for `dpl_E391jrT92GzvU6H7Vqdm5vV7jV1A`, with four runtime files changed and two regression-test files added or updated. The unrelated dirty workspace is excluded. See [release verification](site-audit-fixes-release-2026-11-03.md).

## Findings

### Deleted Notebook entries remained directly accessible to players

A fresh, isolated replica-set HTTP test reproduced this against the published source: after the DM soft-deleted a shared note, the player could still fetch its text and history by ID. Owner player-preview could also receive a successful conditional read. Active lists correctly omitted the note. DM-only note access remained denied; this did not bypass entry audience or room membership checks.

`entryFor` now filters non-DM requests to `deletedAt: null` in the database query. This also covers conditional detail requests before projection, history and player recovery actions. The DM retains access to trash and can recover the entry; ordinary player reading resumes after recovery. A route regression failed with `200` before the fix and passes with `404` afterward. Both the focused route suite and a real Express/MongoDB candidate fixture pass.

Files: `server/routes/notebook.ts`, `server/routes/notebook.test.ts`.

### Unknown site addresses rendered an empty page

The authenticated live route `/audit-missing-page-20261103` had an empty main area and no recovery link, while global navigation remained present. A final catch-all route now renders an explanatory page with a return link. Existing character and Creator routes retain their precedence, and anonymous protected requests still redirect to login. This is client-side recovery; it does not change the static hosting response status.

Files: `src/router/index.ts`, `src/views/NotFoundView.vue`, `src/router/recovery.test.ts`.

### Login fields lacked programmatic labels

The live email and password inputs each had zero associated labels. Their visible labels were adjacent elements without `for` attributes. Login and registration fields now have explicit IDs and associated labels, plus appropriate autocomplete attributes. Server-rendered regression checks verify the login labels and routing behavior.

File: `src/views/LoginView.vue`.

### Backup coverage remains incomplete for campaign data

**Resolved in the subsequent release:** [Complete campaign backup and restore](campaign-backup-2026-11-03.md) is now live, with a successful isolated restore of the actual campaign and hosted/public checks. The following paragraphs describe the original audit finding.

The existing Workshop backup exports characters and custom content. The browser adds device drafts and appearance settings to its download. The backend backup contains no game rooms, Notebook records/history, Maps/assets or city libraries; its restore endpoint likewise restores characters and custom content only. A “site backup” download therefore does not protect those campaign systems. Expanding and validating campaign backup/restore is a follow-up, not part of these four runtime changes.

The isolated test verified a successful library restore with remapped fixture IDs and linked item integrity, refusal to overwrite an occupied account, and collision protection for existing IDs. Production data was not restored or altered.

## Fresh coverage

The live browser used the authenticated persistent profile and a 390-pixel mobile viewport for the main pass. A separate incognito tab checked the login boundary and public builder demo at desktop size. Device/source caches were retained and became fully prepared; this is a functional audit, not a cold-start performance comparison.

| System | Live browser checks | Isolated candidate checks |
| --- | --- | --- |
| Compendium | All 15 browse categories; 14 populated representative readers; empty Other reference; Homebrew files; no-result search/reset; forward/back pagination; spell-level filter/reset | Selected definition availability and current native rules after background pack preparation |
| Workshop | All six areas; all seven steps for class/subclass/race; all eight option kinds and their builder sections; both item dialogs and their selection modes; monster sections; action library; trash; embedded Compendium | Publish all three rule kinds and eight option kinds; monster publishing; reusable action update and stale-revision rejection; native definition delete/restore |
| Creator | All ten steps; standard race and casting-class selection; spell list and on-demand rules | Character creation and selected native definitions; progression/calculation unit coverage retained in the existing suite |
| Character sheets | All six real characters; every available main tab including edit; conditional Shadow Champions tab | Create/edit/conflict; duplicate; export/import; delete; folder placement and revision conflict; template item grant and synchronization |
| Rooms and party | Room list; DM party view; section navigation; player-preview controls and restricted sections | Register/login; join/assignment; role isolation; permitted player HP update; permanent edit denial; DM-only party API; membership revocation |
| Notebook | Seven categories plus All, Bookmarks and DM trash; player-preview categories and missing creation controls | Indexed reader assertion; every category query; search; edit/conflict; history/text restore; delete/recover; private entries; preview writes denied; deleted-note regression |
| Maps | List; overview image decoding; zoom; keyboard pan; fit; region focus; large-map popup; read-only preview without upload controls | Upload/normalization; image content type and ETag; region updates; public/private pins; stale revisions; pin removal; map deletion; invalid image and player writes rejected |
| City libraries | No usable real linked city/pin was exercised in this pass | Enable; link public/private notes; hide private notes and their category names from players; write denial; undo |
| Account/import/backup | Protected Compendium redirects to login with destination preserved; public builder demo opens | Registration/session; bad login; cross-origin write rejection; malformed/unsafe external import rejection; library restore and item-link integrity; logout |
| Owlbear integration | No fresh external tabletop session | Disabled-extension boundary checked through the exact entrypoint. Earlier lifecycle/remembered-connection evidence is retained, not reported as freshly rerun |

The browser evidence contains 161 UI observations, which include repeated surfaces and intermediate states. They are not 161 independent end-to-end scenarios. The later instrumented portion observed 118 API requests, no mutation requests, no HTTP error responses and no uncaught browser errors. Two rapid Notebook category switches cancelled superseded reads; these are expected navigation cancellations. The isolated API pass separately completes all Notebook category requests.

No character, room, note, map, pack or item was saved, deleted or restored in production. Original device data was preserved before editor visits; 40 original keys were restored and compared exactly after editors unmounted, and 80 audit-created keys were removed using the same scoped predicate. Both owned audit tabs were closed.

## Validation

- Narrow candidate: 477 source/test files, with unchanged published files verified by hash. Four runtime files and two test files comprise the allowed difference.
- Candidate automated suite: 242 passed, two conditional external-pack tests skipped; the additional routing/login suite passed both tests in the candidate. Total: 244 passed, two skipped across 31 files.
- The Notebook route suite passed all 57 tests, including the newly reproduced access regression.
- The final isolated HTTP fixture passed 148 requests across nine grouped workflows. The temporary database was dropped and its Mongo process stopped. Fixtures used only a new loopback replica set and synthetic accounts.
- Production frontend build, frontend type check after adding the final tests, and server type check passed.
- Initial local validation checked the recovery page and login changes through the real router and server rendering. Subsequent release checks used fresh automated browser contexts against the hosted candidate and public site, at desktop and mobile widths, with no data mutation requests or browser errors.

Evidence and reproduction helpers are under `.local/full-site-audit-20261103/`: `compendium.json`, `ui-evidence.json`, `live-findings.json`, `fixture-results-baseline.json`, `fixture-results.json`, `fixture-cleanup.json`, `summary.json`, the candidate manifest, and build/test logs. Run `node .local/full-site-audit-20261103/run-fixture.mjs` to recreate the isolated candidate mutation audit. The baseline fixture explicitly records the deleted-entry defect; a baseline pass is not a clean privacy result.

## Remaining limits and priorities

1. The scoped fixes are released after authorization and hosted verification. Subsequent backup and cache releases are described below.
2. Campaign backup/restore coverage is now released and validated; see [the completed backup follow-up](campaign-backup-2026-11-03.md).
3. Continue the unresolved cold/full-navigation delivery investigation from [Notebook rollout and latency verification](notebook-rollout-and-latency-2026-11-03.md). Warm category success does not establish a worst-case latency bound or eliminate the previously observed delivery waits.
4. The [Owlbear approval-render correction](owlbear-approval-release-2026-11-04.md) and [DMV file-preview performance improvement](dmv-preview-performance-2026-11-04.md) are now released and verified. Hosted DMV link requests still receive upstream HTTP 403, despite the same links opening from this machine. The [follow-up report](remaining-audit-checks-2026-11-04.md) distinguishes these findings from the checks that passed.

## Subsequent follow-up — 3–4 November

The later [DMV browser recovery and opening-delay follow-up](dmv-recovery-and-delivery-2026-11-04.md) is also released. It verifies an ordinary browser download of real provider data and an explicit copied-data preview, with 288 tests and hosted/public checks passing. Hosted URL fetching still receives HTTP 403. A slow sign-in request has been correlated in platform logs; its unmeasured lifecycle delay remains unexplained. These targeted checks extend the evidence below without replacing the original full-site audit.

The [static asset cache release](static-asset-cache-2026-11-03.md) removes repeat validation of retained, hashed frontend assets. Hosted and public acceptance checks pass. This closes a specific repeat-opening inefficiency; intermittent cold/full-navigation delays remain unresolved.

Additional isolated browser coverage now exercises a linked city library: DM categories, search/reset, note reader, expansion/compaction, introduction save and undo; player preview hides private entries, their category and management controls while retaining public reading. The source is the exact published application; all mutations use a new loopback database, which is dropped afterward. No uncaught browser errors occurred.

Accepted DMV JSON and EDN character-file previews now pass through the real HTTP endpoint without creating characters. Subsequent save/read retains their original source and backstory. Both previously conditional external-library tests also passed in a separate targeted run: an original external pack from the private backup round-trips through combined export and re-import, and an overlapping copy exercises merge, exact-byte export, duplicate detection and stable spell results after removing one copy. That copy shares the original definitions and is not an independent second library. The targeted run's other 15 tests were unselected, not newly failing or missing tests.

Fresh, user-assisted Owlbear room coverage confirms the installed launcher, account-connected sheet, character selection, refresh, Combat/Equipment navigation and close/reopen in the real SDK environment. It also exposed a null-session expiry render exception during approval. A narrow correction and regression tests pass in the independent extension repository (112 tests, types and game-profile build); the correction is now released after hosted/public verification. The user approved the original connection; the audit uses reading and presentation controls only. It does not freshly exercise expiry, revocation, a separate player session, or changes to HP/resources/inventory in the live campaign. Earlier isolated lifecycle evidence remains separate. Three stored DMV links returned the expected unavailable response; an original character-file preview succeeded but took about 14 seconds. See [follow-up verification](remaining-audit-checks-2026-11-04.md).

This audit covers the published surfaces and the representative workflows above, including the subsequent follow-up. It does not exhaust every character build, rule combination, external import source, browser/viewport, large-file boundary or Owlbear role/session combination. A fresh successful external character-link fetch remains unverified; accepted file imports are covered. Earlier broad calculation/integration checks are documented in [the previous site audit](site-system-audit-2026-11-02.md) and the release reports; their evidence is distinct from this pass.

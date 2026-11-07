# Creator, Compendium and Notebook startup: local verification

**Subsequent release:** a smaller, isolated safe subset was published later on 3 November. See [production release and remaining work](startup-release-2026-11-03.md) for the actual deployed scope and public checks. The broader Notebook prototype described below remains local. The original local-only observations below are retained as historical evidence.

Sir, all three areas have local candidates and passing automated checks. Nothing was uploaded, deployed, committed or pushed. The production frontend still matches the previous Workshop release. These changes have not been measured as live candidate performance.

## Scope and baseline

The baseline is the frozen 445-file source of `dpl_6DxQ5VUiqmDPXj8YQFBiMXsQRdki`. A separate local source copy in `.local/startup-three-20261103/source` contains 23 runtime files and 16 selected test files over that baseline. Its production frontend build, backend types and tests pass. The held large-response middleware patch and unrelated extension/authentication changes are excluded.

The root workspace already contained substantial unfinished Notebook work before this task. That work was preserved, exercised and explicitly included in the local Notebook candidate. The candidate environment copies the production schema plus only the default-off Notebook listing flag; it does not copy the root's unrelated environment changes. The review patch is against the frozen published source, **not against the dirty root checkout**.

## Character Creator

The standard SRD selection-list asset was already published. The remaining large response was `/api/content/creation-options`, which sends complete imported creation rules.

The new `/api/content/creation-selections` response contains identities, names, source/version labels, aliases, subclass/subrace parents and spell filter fields. The creator requests complete class, race, subclass, subrace, background and spell definitions when selected. Feats retain full text search by fetching the feat category when browsing feats or restoring selected feats. A new unconfigured draft does not fetch any full imported definitions.

Every definition request carries the selection response's exact account-scoped revision. A changed library returns 409 rather than mixing current rules with an older list. Selected requests coalesce within the builder; failed reads can retry. Disposal/account changes reject late definitions. Creating a character remains blocked while selected definitions or selected feat rules are missing. The old full endpoint is retained for existing clients.

| Same real-owner catalogue | Existing full response | Selection response |
|---|---:|---:|
| Decoded JSON bytes | 2,696,833 | 506,709 |
| Locally calculated gzip bytes | 427,194 | 65,606 |

The decoded reduction is 81.2%. Gzip figures use the same local compressor and are not claims about the production gateway's encoding. The lists preserve the exact order and identities of 36 classes, 102 races, 74 backgrounds, 244 subraces, 300 subclasses, 228 feats, 36 languages and 316 spells. All **35,688** real-catalogue subclass/class and subrace/race matching comparisons remain equal.

A fresh read of the old live endpoint returned its complete 2.70 MB body in 3.535 seconds during this task. That is a separate retained-cache observation, not a repeat of the historical 9.8-second whole-page opening and not a live before/after comparison.

Limitations: the server still assembles the existing creation catalogue before projecting the lists, so this primarily removes transfer and browser parsing work. It does not prove that cold database assembly is faster. Definition reads add requests after selection; restored drafts load their selected dependencies. The new list client does not yet reuse the old full-catalogue IndexedDB cache. A whole feat category is loaded when needed so searches by effect text retain their behavior. Initial creator JavaScript was approximately unchanged in the built-browser fixture: 419,785 versus 421,501 bytes, a 1,716-byte increase.

## Compendium

The page now gives an authenticated device-index attempt a 200 ms head start, then starts one ordinary server browse if the local attempt is still pending. A quick verified device hit issues no server browse request. The first valid result wins and cancels the losing read; navigation cancels both. An authoritative access denial is surfaced and clears displayed/cached results. Owner identity is included in memory page keys, and a late response cannot paint after an account change. Device owner/revision/digest checks remain in place.

The entry editor and Orcbrew file-management component are deferred until used. No speculative route warming was reintroduced, and no global navigation error handler was changed.

In an actual built-browser fixture with a deliberately stalled 1.8-second revision response and a 100 ms browse response:

| Controlled slow-validation fixture | Existing | Candidate |
|---|---:|---:|
| Revision request to server-browse start | 1,494 ms | 204 ms |
| Whole fixture page to visible results | 1,907 ms | 897 ms |
| Initial JavaScript bytes requested | 589,689 | 570,783 |

These are finite local fixture observations. The unit check establishes the exact 200 ms scheduling boundary independently. The healthy real-worker/IndexedDB browser scenario returns device results without a server browse.

Tradeoff: a slow but eventually healthy local validation may now cause an unused server read. There is at most one such browse per load; cancelling its HTTP request does not guarantee already-started backend work stops. The initial JavaScript reduction is modest, about 3.2%; this does not explain or eliminate the historical four-second asset-delivery stall. Platform/network tail latency remains unproven.

## Notebook and player preview

The current room view mounts a player sheet while showing the Notebook, and switching player preview forces navigation to Characters. That starts unrelated character/reference work alongside Notebook requests.

The local change keeps Notebook or Maps open when toggling preview, defers the sheet until Characters is requested, and defers the party dashboard until visited. Character-sheet and dashboard code are loaded lazily. Existing draft/save guards remain in force. Explicitly opening Characters still loads the sheet normally.

The retained local Notebook startup work begins link-target requests alongside the initial listing, combines initial listing/navigation under one permission context, reuses scope/version-checked navigation and link metadata, and starts player/preview lists at All rather than first loading and discarding People. Room detail's independent member/character reads overlap only after authorization.

The built-browser comparison reproduced **two unrelated sheet/reference reads** on the old player Notebook opening and **zero** on the candidate opening. Candidate listing and link-target requests began less than 1 ms apart in the final DM/player fixtures. Preview remained in Notebook, preserved the preview-character parameter, offered no New entry control, and started sheet requests only after explicitly opening Characters.

The real local HTTP/database check compares merged initial responses with the old endpoint for DM, player and DM player preview. Full contracts remain equal. Hidden entries and link targets remain filtered, and member revocation immediately denies both listing and links.

Release limitation: the broader retained indexed Notebook reader is still **default-off**. Its production indexes, readiness/certification, backfill and writer drain have not been checked or performed. Its schema/index and derived-writer changes require the existing [Notebook rollout preflight](notebook-rollout-verification-2026-11-02.md) before a broader release. No production listing flag, index or saved note was changed. The startup results do not establish that every historical six-second category request is eliminated.

## Verification and issues

- Full root ordinary suite: **957 passed, 67 conditional skips**. Three additional shared projection tests pass when invoked explicitly; the ordinary test configuration does not include `shared/`. The first run found three tests still mocking the old full-catalogue loader; those fixtures were updated, selected-definition/feat-restoration checks were added, and the final full run passes.
- Frozen local candidate: **252 passed, two conditional skips** across 27 files. Frontend production build and frontend/backend TypeScript checks pass.
- Actual Express plus fresh loopback Mongo replica set: **nine aggregate checks across 58 HTTP requests**. Covers creator exact identities/definitions, unauthorized/foreign revision requests, bounded endpoint shapes, stale revisions, Notebook DM/player/preview equivalence, link filtering/revocation, and regressions for the already released Workshop summaries, publication, replacement, export and deletion. The fixture database was dropped and all fixture processes stopped.
- **Ten actual built-frontend Edge scenarios** pass. They cover both creator startup paths, chosen rules/deferred feats, restored selections, slow validation before/after, a healthy device index, old hidden sheet reads, candidate DM preview and real-player Notebook startup. Final scenarios have no page/console errors or server writes; temporary profiles and local static servers were closed.
- Early browser failures were fixture problems: an absolute send-file path beneath `.local` was denied by Express; section selectors omitted the UI's full titles; the Notebook fixture lacked its required `reading` data; and request-event checks ran before the route adapter logged the same request. These were corrected and the complete final run passes. No test failures remain.
- A final read-only call to Vercel's management API returned **403 Forbidden**. No deployment was attempted. Independent public/previous-immutable HTML reads both returned 200 and the same entry `/assets/index-u_Mtr30C.js`. Management API access must be restored before any later deployment review; the cause of the denial was not established.

## Review artifacts

The [local review patch](../../output/startup-improvements-local-2026-11-03.patch) includes only the explicit runtime/test scope against the published snapshot. It includes the retained, unpublished Notebook groundwork described above. Do not apply it directly to the already modified root checkout.

Ignored evidence lives in `.local/startup-three-20261103/`: `baseline.json`, `scope.json`, `final-gates.json`, `creator-before.json`, `creator-payload.json`, `browser-summary.json`, `browser.json`, `http-smoke.json`, `http-smoke-cleanup.json`, `final-tests.log`, `isolated-tests.log`, `final-build.log`, `final-frontend-types.log`, `final-server-types.log`, and `public-read-only-check.json`. Real-owner response bodies are private and are not included in the review patch or chart.

The release remains on hold, as requested. Future hosted timing and Notebook production preflight are separate steps; local results should not be presented as deployed speedups.

# Compendium loading follow-up, 28 October 2026

Follow-up: [hosted stage profiling](server-loading-profile-2026-10-28.md) attributes the multi-second waits to component delivery and measures the optional cache deadlines. It includes a separate unpromoted diagnostic deployment and read-only Atlas inspection. The earlier local candidate and its measurements below remain unchanged.

The approved creator-cache change is retained locally. All eight of its application/test source hashes match the start of this follow-up. The four unrelated dirty extension files, main.ts and DashboardView.vue also retain their protected hashes. No commit, push, deployment, hosted configuration change or hosted database write was made.

## Persistent-cache investigation

The existing production logs identify `MongoBulkWriteError` during prepared monster/equipment index persistence and a `MongoOperationTimeoutError` during a monster cache lookup. They record only the error name, not the failing numeric code or bulk-write codes. The earlier read-only hosted database diagnostic could not obtain a usable sensitive credential. It was not retried here. The precise hosted cause remains **unresolved**; no index, quota, permission or timeout repair is claimed.

The captured 126-pack library was replayed and prepared in a new, explicitly named disposable database on `127.0.0.1`. The actual current browse handlers successfully persisted the two-chunk monster index and one-chunk equipment index. Separate fresh application workers then read those persisted indexes without warnings. Full response hashes matched across construction and subsequent cold-process stored reads.

| Category | First build/read | Fresh-process stored read | Timed Mongo commands, build / stored |
| --- | ---: | ---: | ---: |
| Monsters | 361.48 ms | 160.65 ms | 15 / 6 |
| Equipment | 128.80 ms | 57.44 ms | 16 / 6 |

These are one diagnostic sample per case, not repeated performance statistics or a before/after implementation gain. Imports, connection establishment and preparation are outside timing. Local persistent index initialization was explicit. This rules out an inevitable failure of the captured data/schema/codec in this environment; it does not validate the hosted collection's indexes, capacity, permissions or timing.

The only server behavior change is narrow diagnostics at the existing cache warning sites: optional numeric top-level, bulk-write and write-concern codes. The helper omits error messages, query/filter objects, document payloads, key values and credentials; code lists are deduplicated and bounded to eight values. Persistence remains awaited, existing strict-job failures remain failures, and ordinary optional-cache failures still return a validated rebuilt index. There is no new cache, database migration, background serverless write or relaxed validation. These diagnostics provide no independent loading-speed benefit and will not produce hosted evidence until a reviewed deployment runs them.

## Local frontend candidate

`CompendiumEntryEditor.vue` now loads its `EntryBuilder` form asynchronously. The editor shell still mounts normally, preserving the source/revision request, modal focus and inert background, unsaved-draft guard, save/review/restore logic and closing behavior. The form download starts when the editor shell mounts, alongside its source request. Browsing never mounts the editor and therefore does not download its form or authoring dependencies. The form has explicit loading and failed-download messages; a failed form can be closed safely and the page reloaded to retry.

Only the form import changes; no rule fields, authored data, permission checks, source schema or API contract is removed. This is a download/parse change, not a fix for the existing 4–12-second hosted catalogue waits. It benefits browsing on a constrained network and moves work to the first editor opening.

### Build calculation

Both production builds include the retained creator cache. Static route closures include the shared entry and recursive static imports, excluding dynamic tools until requested. gzip is calculated independently per output asset using the same local implementation; these are not hosted wire sizes.

| Initial Compendium assets | Before | Candidate | Reduction |
| --- | ---: | ---: | ---: |
| JavaScript, raw bytes | 598,531 | 432,135 | 166,396 |
| JavaScript, gzip bytes | 180,346 | 132,927 | **47,419 (26.29%)** |
| CSS, gzip bytes | 41,055 | 35,909 | **5,146** |
| JS + CSS, gzip bytes | 221,401 | 168,836 | **52,565 (23.74%)** |

At 200,000 bytes/s download, the transfer-only opportunity is `52,565 / 200,000 = 0.263 s`. This is not added to the measured browser improvement. Auth/shared chunk restructuring adds 135 gzip bytes to the initial shared JavaScript closure, 776 to the creator closure and 906 to the sheet closure relative to the creator-cache baseline. Those routes were not timed in this follow-up; their byte changes are small but are not hidden. The retained creator cache was separately reverified against the new production bundle.

### Timed browser results

Headless Edge 155.0.4283.62, five fresh isolated contexts per build/profile, alternating before/after order. Static and API responses use gzip and `no-store`; the real browse/detail/edit handlers and disposable database were warmed before measurement. No CPU throttle. Each context measures navigation to populated Compendium spell results, first Edit entry click to the actual Acid Arrow spell form, then a second opening in the same document. Both builds use the same source library and source spell. Four unrelated standard-rule bootstrap lists use deterministic repository fixtures; actual spell browse/detail/edit requests use the current server.

The constrained profile is 80 ms latency, 200,000 bytes/s download (1.6 Mbit/s) and 100,000 bytes/s upload. These are local controlled timings, not production web vitals or mobile CPU results.

| Profile / action | Before median | Candidate median | Difference |
| --- | ---: | ---: | ---: |
| Constrained: browse readiness | 1,754.1 ms | 1,478.0 ms | **276.1 ms faster (15.74%)** |
| Constrained: first editor form | 218.8 ms | 839.3 ms | **620.5 ms slower** |
| Constrained: reopen editor | 216.5 ms | 217.3 ms | 0.8 ms slower, no meaningful change |
| Loopback: browse readiness | 98.4 ms | 97.3 ms | No meaningful change |
| Loopback: first editor form | 48.0 ms | 47.9 ms | No meaningful change |
| Loopback: reopen editor | 49.4 ms | 45.5 ms | Small scheduling-sensitive difference |

Constrained browse ranges were 1,742.2–1,780.8 ms before and 1,460.8–1,504.1 ms after. First-editor ranges were 217.8–220.6 ms before and 836.0–856.5 ms after. All 20 timed browsing sessions returned the same initial spell-result labels without captured page errors or library alerts; the candidate never requested the EntryBuilder chunk while browsing.

An earlier candidate waited for the source response before starting the form download. Starting the download at editor mount preserved parallel requests but did **not** materially improve the measured first-editor cost: its earlier constrained median was 839.4 ms versus 839.3 ms now. The whole dependency download remains the cost. Do not claim an editor speedup from this adjustment.

### Verification and decision boundary

Actual local edition saves, character-review reads and source restoration passed for both builds at 1440px and 390px widths. Unsaved edits survived an attempted close, the Keep editing action preserved the input, and normal close restored focus and body scrolling. Form field values and rendered form text matched between builds. All four screenshot pairs—browse and editor at both widths—were byte-identical after fonts and animation settling.

Deliberately delayed and blocked form chunks produced the intended loading/error state. Closing while a chunk was pending or failed restored the page; reopening after completion and reloading after a blocked download both recovered. No captured page errors occurred in these checks.

The retained creator-cache browser checks passed again against the new bundle: actual persistence/checksum and 304 reuse, complete expired-cache refresh, restored race/subrace/class/subclass/feat/spell state, forced retry, offline/401 validation failures, real pack-set revision invalidation, separate accounts, actual logout clearing and blocked IndexedDB fallback.

Full working-checkout suite: **479 passed, 55 skipped**. Frontend typecheck, server typecheck and production build pass. A new failure-path test confirms an optional bulk-write failure still serves the rebuilt index while logging numeric codes without private message/document contents. Other diagnostic tests cover bulk/concern code extraction and bounded lists. These checks include the pre-existing dirty extension files; the earlier clean-committed-snapshot server limitations remain separate.

The creator cache remains retained. The Compendium form split is kept as a **local reviewable candidate**, with the first-editor delay explicit. It is favorable for browsing-heavy use, but a session that immediately opens its first editor moves more delay to that action than it saves during navigation. No claim of universally faster workflows is made. It remains uncommitted and undeployed; the hosted cache failure is not repaired by this frontend change.

The next highest-value evidence is the numeric cache failure from a reviewed hosted deployment, plus timings for the component-read and assembly stages. Do not disable validation, delete hosted indexes, increase timeouts or add another persistent cache based only on the current error names. Existing preview/promotion issues remain held.

## Evidence and cleanup

Ignored `.local/compendium-loading-20261028/` retains the disposable fixture harness/state, `cache-probe.json`, before/after production builds, `assets.json`, `css.json`, `browser-bench.json`, `browser-verification.json`, `creator-cache-verification.json`, screenshots, test/typecheck/build logs and protected creator hashes. The earlier sequential-form timings are separately retained in `browser-bench-sequential-form.json`. No hosted content or credentials were captured by this follow-up. Only the fictional loopback account's spell edition was changed during checks; imported packs and character records were not edited. The separate creator regression fixture adds an empty valid local pack to check invalidation.

The local HTTP server is stopped and the disposable database removed after verification. The cleanup helper checks its loopback host and the `compendium_loading_20261028_[a-f0-9]{10}` database-name boundary before dropping it. Original source fixtures and prior evidence remain intact.

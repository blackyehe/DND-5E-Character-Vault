# Local optimization — 27 October 2026

Repeated rule processing was the clearest performance opportunity with limited behavioural risk. The first batch removes duplicate work within individual sheet renders and server responses. It introduces no persistent cache and changes no database records, permissions, API response fields, polling intervals, or deployment settings. No commit, push, or deployment was performed.

## Order by drawback and regression risk

The order considers the consequences of a mistake and the verification required, rather than potential speed alone. The first four batches are committed for the authorized Git push; the clean-snapshot verification limits are recorded below. Live promotion remains held.

| Order | Change | Status, impact and remaining drawback |
| --- | --- | --- |
| 1 | Scope Vitest discovery to current application sources | Done. The old command collected archived releases, partial copies and prototype node:test files. Current src/shared/server tests and the opt-in benchmark are included using Vitest's standard test/spec naming pattern. Prototypes and archived evidence are preserved and can be run separately. |
| 2 | Remove unused EntryFieldEditor.vue | Done. Only recursive self-references existed; CompendiumEntryEditor uses EntryBuilder. All 62 production assets were byte-identical immediately after removal. Maintenance improvement, no download benefit. |
| 3 | Derive benefit rows once per characterBenefits call | Done. The movement follow-up reuses the rows already processed. Output and ordering stay identical. The standalone reviewed/heavy benefit workloads improve about 23–34%. |
| 4 | Reuse benefits within a render/response | Done. CoreTab uses Vue computed values; party and plugin projections pass a local snapshot to existing helpers. Existing calls still calculate fresh values. No ID/object-identity cache can retain an old character's bonuses. This is the largest measured gain. |
| 5 | Put core pure math in shared/calc.ts | Done. Implementation matches the old module exactly apart from its new comment. Frontend imports retain a compatibility re-export; shared/server consumers use the shared implementation. Structural benefit, no independent speed claim. Broader sheet/equipment module moves remain separate. |
| 6 | Reuse the wizard's spell-definition loader | Done. Two identical standard/imported lookup branches now use one private function. Existing endpoints, lazy API import, error handling and choice rules stay intact. Maintenance benefit, no independent speed claim. |
| 7 | Extract larger spell/feat presentation and wizard sections | Later. Use small presentational extractions; do not merge creation and level-up validation. More state/lifecycle changes than the private helper above, with no established loading benefit. |
| 8 | Use the focused rule library for expanded plugin sheets | Done locally in the second batch below. The existing reader replaces the full-library request; its legacy/missing-component fallback stays intact. Median first request on the isolated 126-pack replay falls from 4,845 to 537 ms. Existing first-batch CPU measurements exclude this database path. |
| 9 | Share visibility-aware polling lifecycle | Lifecycle extraction done locally in the third batch below. Existing 15-second and 3-second intervals, refresh guards and signal choices are preserved. A controlled request timeline matches the original exactly. Signal coalescing/cancellation changes remain deferred; no network speedup is claimed. |
| 10 | Add byte budgets to full-library and browse caches | Investigated; a full-library replacement/recency bug is fixed locally in the fourth batch below. Four-owner capacity is preserved. Byte budgets remain deferred: fictional workload measurements do not establish a safe policy for real large libraries or browse traffic. |
| 11 | Separate plugin preview/demo packaging | Skipped at the user's request on 28 October. The local candidate was reverted byte-for-byte; no runtime packaging change remains. Fifth-batch measurements below are historical evidence. |
| 12 | Move route-only CSS and simplify overrides | Later. Measure initial CSS and check navigation/theme/mobile combinations. Shared variables and cascade ordering make this visually riskier than a module move. Current CSS is unchanged. |
| 13 | Consolidate capability flags | Last. Existing helper reuse would reduce repetition, but the benefit is small and mistakes can affect authorization. Preserve strict schemas and explicit permission checks. Requires pairing, redemption, expiry, revocation and read-only integration coverage. |

Optional persisted-index overhead is also a database measurement item. Do not move writes into an unawaited serverless promise. Persistent browser caching remains deferred under the user's earlier direction.

The separate website startup investigation on 28 October discarded both the whole-dashboard split and the small link-import panel split. The sixth-batch measurements below are historical evidence; the user requested larger benefits. Item 12's broader CSS work remains deferred.

The seventh batch targets the larger character-sheet download instead. Its retained local candidate reduces the sheet's compressed JavaScript by 22.7% and improves controlled constrained-network sheet readiness by approximately 200–250 ms, with an explicit first-editor/item-creator loading cost.

## First-batch measurements

Machine: AMD Ryzen 7 5800X3D, Node v26.8.2. Fixed fictional characters with 0, 12 and 40 reviewed definitions; the latter two have five modifiers per definition. These are controlled workloads, not a claim about the user's actual characters or their frequency in play.

Each workload is warmed, calibrated toward 25 ms per sample with 1–2000 iterations, and sampled 15 times. Values below are median milliseconds per operation. Very fast plain-character samples hit the iteration cap. Measurements run without another build/test task in parallel. The benchmark includes a real Vue server-rendered CoreTab with Pinia, rather than a manually recreated copy of its template.

| Fixture | Workload | Before ms | After ms | Reduction |
| --- | --- | ---: | ---: | ---: |
| Plain | Benefits only | 0.00031 | 0.00036 | No meaningful difference |
| Plain | Party snapshot | 0.00629 | 0.00587 | No meaningful difference |
| Plain | Plugin projection | 0.03933 | 0.04002 | No meaningful difference |
| Plain | Proficiencies panel SSR | 1.32335 | 0.36175 | 72.7% |
| 12 definitions | Benefits only | 0.33934 | 0.26150 | 22.9% |
| 12 definitions | Party snapshot | 2.34620 | 0.30781 | 86.9% |
| 12 definitions | Plugin projection | 14.23595 | 0.72819 | 94.9% |
| 12 definitions | Proficiencies panel SSR | 73.82770 | 0.89343 | 98.8% |
| 40 definitions | Benefits only | 1.63268 | 1.07418 | 34.2% |
| 40 definitions | Party snapshot | 11.69090 | 1.28676 | 89.0% |
| 40 definitions | Plugin projection | 73.44960 | 3.86924 | 94.7% |
| 40 definitions | Proficiencies panel SSR | 357.25340 | 3.11214 | 99.1% |

These results justify keeping the calculation changes. The richer fixtures save roughly 73–354 ms of local panel-render CPU and 14–70 ms of plugin-projection CPU per operation. Plain-character microsecond differences are noise. These numbers exclude MongoDB, network transfer, browser layout/paint and cold server startup, and therefore do not imply the website loads 99% faster.

The first, single-pass-only measurement reduced the 12-definition panel to 49.67 ms and the heavy panel to 217.76 ms. Most of the final gain comes from avoiding repeated calls across the render/response, not merely removing the second row traversal.

Full production assets total 1,888,623 → 1,888,561 bytes. JavaScript drops by only 62 uncompressed bytes; CSS is identical at 336,332 bytes. There is no material download-size claim. In particular, the unused-editor deletion alone changed zero shipped bytes.

The unscoped default test run collected 469 files and took 64.35 seconds, failing on historical copies. The scoped command collected 64 current test files; recorded runs took 5.35–7.66 seconds. This is corrected discovery, not an equivalent-suite execution-speed benchmark. No current application test was removed to produce that result.

## First-batch verification and limits

- Website suite: 446 passed, 54 skipped, zero failures. The skips comprise the existing 53 opt-in cases plus the deliberately opt-in benchmark.
- Separate Owlbear frontend: all 93 unit tests passed. Its source was not modified.
- Frontend typecheck/production build and server typecheck passed.
- All 24 baseline hashes match: benefits, party output, plugin output and rendered panel HTML, across three fixtures before and after nested edits.
- A normal regression test also checks rendered skills/saves after level changes, nested rule edits, attunement changes, ability changes and switching characters.
- The core math implementation is identical to its pre-change version. At the end of the first batch, the four previously modified extension files (api.ts, approval-page.ts, models.ts, production-trial-config.ts) retained their original hashes from the start of that batch. The second batch changes only the library import/call in api.ts; the other three still match.
- No live accounts, campaign records, database writes, hosted requests, plugin grants, commits, pushes or deployments were used. Isolated database-backed plugin lifecycle tests were not activated; this batch does not change their authentication/database code.

## Repeating a first-batch measurement

The opt-in harness is `scripts/benchmarks/sheet-performance.test.ts`; fixtures are adjacent. In PowerShell:

```powershell
$env:SHEET_BENCHMARK_LABEL = 'check'
npm.cmd test -- scripts/benchmarks/sheet-performance.test.ts --reporter=dot
```

The harness compares all output hashes against the original local baseline before saving the run. Raw baseline, intermediate and final results, p90/sample timings, build fingerprints, protected-file hashes and the calculated comparison remain in ignored `.local/optimization-2026-10-27/`. The `before` label was recorded before runtime edits; rerunning it against optimized code would replace the baseline and invalidate the comparison. Without that local baseline, establish one on the original source before testing a new candidate.

## Second batch: focused plugin references

Expanded plugin references now use `characterRuleLibrary`, the same reader already used during character resolution. The projection accepts `CharacterRuleLibrary` explicitly, so a partial catalogue is never cast to a full Workshop library in application code. This adds only an import/call change in `server/extension/api.ts` and a type change in `server/extension/sheet.ts`. It reuses existing cache limits, owner activation, revision checks and full-library fallback. The two calls still check revisions independently; this batch does not introduce a request-wide snapshot or another cache.

### Timed results

AMD Ryzen 7 5800X3D, Node v26.8.2, local MongoDB on `127.0.0.1:27017`. A unique disposable database replayed the retained 126-pack source fixture. Prepared components were built before measurement. One fictional level-5 Artificer/Aarakocra with imported spells and feats exercised the real Express `/api/extension/v1/characters/:id/references` route, including session/account/room/character reads and response serialization.

Each version ran in five fresh Node processes, with one first request and fifteen subsequent requests per process. No build or test task ran alongside the timed workload. Times include loopback HTTP through JSON response consumption, but exclude process startup, database connection, application initialization and component preparation. “Cold” means empty application RAM caches; MongoDB's filesystem cache was not flushed. Values are medians, with warm p90 over 75 requests.

| Workload | Before ms | After ms | Reduction |
| --- | ---: | ---: | ---: |
| First expanded-reference request, median of 5 | 4,845.43 | 536.63 | 88.9% |
| Subsequent request, median of 75 | 10.90 | 8.05 | 26.1% |
| Subsequent request, p90 of 75 | 14.51 | 9.13 | 37.1% |

First-request ranges were 4,775.89–6,504.67 ms before and 534.42–544.37 ms after. MongoDB commands during the first request fell from 327 to 20; warm requests used eight commands in both versions. The main established benefit is avoiding the cold full-pack read/parse/build. The approximately 2.85 ms warm difference is small and sensitive to local scheduling. These measurements are not a production latency or whole-website loading guarantee; legacy/unprepared owners retain the full-reader cost.

### Equivalence and verification

- All 160 measured HTTP responses (80 per version) have the same serialized SHA-256 hash.
- Compared all 1,059 entries across the six needed categories: 37 classes, 301 subclasses, 103 races, 74 backgrounds, 228 feats and 316 spells. Full/scoped serialized definitions, all 104 resolved rules and their baselines match. A fictional character for every entry produced identical resolved character data and expanded projection; spell cases also exercise aliases and content keys. Raw EDN parser objects have null prototypes while decoded prepared objects have ordinary prototypes, so this comparison checks serialized values and actual projection behavior rather than prototype identity.
- Added a regression test for two Workshop revisions of each class/subclass/race lineage, retaining only the latest trait in the focused projection. Existing approved spell editions and unavailable references remain covered.
- Added four real-HTTP route tests with stubbed database reads: imported/SRD/missing references use the owner's focused reader; expanded approval and assignment rejection precede library loading; compact vitals retain their single resolution call.
- Separately exercised the real full-library fallback with prepared mode disabled and with every ready component manifest removed from the disposable database. Both rebuilt the full library and returned the baseline response hash. These are correctness checks, excluded from the performance samples.
- Website suite: **451 passed, 54 skipped, zero failures**. The skips remain existing opt-in database/lifecycle cases and the CPU benchmark. Frontend typecheck/production build and server typecheck passed.
- The disposable database `plugin_library_20261027_3a2ca1e7fd` was dropped after verification. No hosted requests, live account/campaign writes, configuration changes, commits, pushes or deployments were performed. Other pre-existing edits remain in place; approval-page.ts, models.ts and production-trial-config.ts retain their starting hashes for this batch.

The presentation/wizard extractions in entry 7 remain deferred: they have no measured loading benefit, and broad component/state changes are unnecessary for this gain. At the end of the second batch, polling, cache policy, packaging, CSS and permission changes remained separate investigations. The third batch below addresses only polling lifecycle reuse.

### Local evidence and repetition

Ignored `.local/plugin-library-2026-10-27/` contains `before.json`, `after.json`, `comparison.json`, `equivalence.json`, `fallback.json`, the starting API/sheet source copies, protected-file hashes, and the local `run.ts` harness. It depends on the retained, digest-verified `output/compendium-prepared-reader/v2` snapshot and a local MongoDB process. It never reads `.env` or selects a hosted database.

The recorded commands were:

```powershell
node --import ./server/node_modules/tsx/dist/loader.mjs .local/plugin-library-2026-10-27/run.ts setup
# Before changing the API reader:
node --import ./server/node_modules/tsx/dist/loader.mjs .local/plugin-library-2026-10-27/run.ts measure before
node --import ./server/node_modules/tsx/dist/loader.mjs .local/plugin-library-2026-10-27/run.ts verify
# After changing the API reader:
node --import ./server/node_modules/tsx/dist/loader.mjs .local/plugin-library-2026-10-27/run.ts measure after
node --import ./server/node_modules/tsx/dist/loader.mjs .local/plugin-library-2026-10-27/run.ts fallback
node --import ./server/node_modules/tsx/dist/loader.mjs .local/plugin-library-2026-10-27/run.ts cleanup
```

The fixture database has already been removed. Preserve these evidence files when repeating: establish a new before/after pair against the same newly prepared fixture database, using the pre-change API for the new baseline. Do not overwrite the recorded `before` label with optimized code or compare responses from different fixture databases, whose character IDs differ.

## Release preparation: verification initially required

The user authorized release if the checks support it. The public alias was verified through the existing authenticated Vercel browser session: it still points to `dpl_7FB8zBXowAKfqZt8izXd8SVFTY53`. All 370 uploaded source hashes matched the retained audited library-recovery source.

An isolated candidate applies the first batch's runtime changes and the focused plugin reader to that exact live source. Its manifest updates 17 existing files, adds `shared/calc.ts`, and omits the unused editor, retaining 370 uploaded files in total. In particular, the API change was applied directly to the production version; unrelated local extension authentication, approval, model and configuration edits are excluded. The polling work below is also excluded from this frozen release manifest.

Candidate validation passed: 336 relevant tests across 54 files, frontend typecheck/build, and server typecheck. Existing production source/configuration is retained for unrelated paths. Remaining release checks are the Vercel build, uploaded-source audit, preview asset comparison and authenticated smoke checks, followed by promotion and public verification.

**At this initial preparation stage, no deployment had been created.** The saved CLI credential returned HTTP 403 (`Not authorized`). The authenticated browser could read the project, but deployment creation returned HTTP 403 with `challenge_required_email_otp` for `create deployment`. The subsequent verification and unpromoted deployments are recorded below.

The isolated source, exact baseline/upload manifests, request body and validation/rejection details remain in ignored `.local/optimization-release-20261027/`. They contain no copied signing keys or browser session tokens. No commit or push was performed.

### Verification completed; promotion held after hosted checks

Vercel account settings already marked the primary email verified. Deployment creation required a separate elevated-session email code. At the user's request, Vercel's email-code endpoint returned HTTP 200 with `sent: true`; the user supplied the code, and verification returned HTTP 200 with `sudo: true`. The code is not retained in project evidence. The user also signed in to the reviewed website deployment for authenticated smoke checks.

The frozen candidate was created as **`dpl_ED1sRr7rbmtmNFJSBTGRbwLJjXcy`**, at `https://dndoldal-kwha57f0q-dndenjoyerstudio.vercel.app`. Its Vercel build reached READY. All **370 uploaded source hashes** exactly match the intended manifest, excluding the unrelated local authentication changes and local polling extraction.

Hosted verification established:

- All **19 CSS assets** match the existing live deployment byte for byte, totaling **336,296 bytes**. This compares the actual hosted builds; the earlier 336,332-byte figure belongs to the local checkout build and is not the hosted baseline.
- Ten authenticated GET response payloads match SHA-256 hashes between the public baseline and review deployment: account, character list, room list, creation catalogue, spell browsing, a rule-rich character sheet, its references, advancement options, spell options, and a six-character party snapshot. All returned HTTP 200. Raw character/account payloads are not copied into the evidence files.
- The rendered proficiency panel matches production text, with 18 skill rows and six saving throws. No character changes were made.
- Anonymous character navigation redirects to the login page at 1440px and 390px without horizontal overflow or browser exceptions; anonymous ordinary character API access returns 401. The browser harness blocks non-GET API requests.

**Promotion is blocked by the Owlbear boundary.** The existing public release returns the expected 403 without an extension origin and 401 with the permitted extension origin but no bearer session. The reviewed deployment returns 503 in both cases. Its sanitized Vercel runtime diagnostic is `owlbear-initialization-failed`, stage **`pairing-indexes`**, kind `unclassified`.

A separate, explicitly unpromoted diagnostic deployment, **`dpl_EYgwa3B7UYsxQTXNDZ8ve9iEGsi9`** (`https://dndoldal-bu8jfe4rn-dndenjoyerstudio.vercel.app`), changes only the diagnostic module in addition to the candidate. It adds fixed error-class labels and a fixed buffering-timeout label, without logging raw errors or secrets. That build also reached READY and returned 503 with the same unclassified pairing-index diagnostic. It is not a replacement release candidate and must not be promoted.

The candidate's real extension initialization was also exercised against a unique disposable local MongoDB database after an 11-second connection delay. Initialization succeeded in 143ms and the permitted-origin unauthenticated request correctly returned 401. The fixture database `opt_init_20261027_eabb88a6` was dropped. This did not reproduce the hosted failure and does not establish its cause. The initialization/model source in the frozen candidate remains identical to the production baseline; no speculative authentication, index, or database repair was applied.

The hosted timings are single smoke observations, not a controlled speed benchmark: creation catalogue 11,072/10,980ms, resolved sheet 10,441/10,408ms, references 843/856ms, and party snapshot 1,962/2,011ms, before/review respectively. They support payload checks, not a production performance-improvement claim. Initial malformed party probes returned matching 400 responses before the correctly parameterized six-character requests returned 200. An expired local fixture cookie was rejected with 401; subsequent authenticated checks used the user's actual browser sessions. Omitting all cookies on the Vercel-protected preview caused a browser fetch rejection, so anonymous checks used a separate empty browser context with the existing hosting bypass.

**No promotion occurred.** A final authenticated Vercel alias lookup still resolves `dndoldal.vercel.app` to **`dpl_7FB8zBXowAKfqZt8izXd8SVFTY53`**. Publishing is conditional on resolving and rechecking the hosted extension initialization failure. No campaign/character writes, commit, or push were performed by these checks. Diagnostic initialization may attempt the application's existing collection/index setup; it is not a strictly database-read-only operation.

Evidence is retained in ignored `.local/optimization-release-20261027/`: source audit, hosted asset comparison, browser API hashes and equivalence report, proficiency comparison, anonymous browser checks, deployment metadata, and blocker diagnostics. `.local/optimization-diagnostic-20261027/` holds the separate diagnostic request and disposable local initialization harness. The local polling work below remains excluded from both deployments.

## Third batch: shared polling lifecycle, local only

`src/composables/useVisiblePolling.ts` now owns timer/listener setup and cleanup for the party dashboard, room workspace, notebook and maps. The room's 3-second quick-sheet timer uses the same helper with focus/visibility signals disabled. The notebook retains its existing focus-only behavior; it does not gain a visibility-change request. Other pollers retain both signals.

Intervals remain 15 seconds for room/party/notebook/maps and 3 seconds for quick sheets. Initial loads, explicit refresh buttons, dirty-draft/save guards, access checks, request cancellation and stale-response ownership stay in the existing callers. The helper adds no debounce, coalescing, cache or request cancellation. Party timers/listeners now register on mount rather than during setup, so server rendering starts no browser work.

### Controlled timed request comparison

The real `usePartyDashboard` composable was mounted with a custom Vue renderer, a fake clock and stubbed HTTP responses before and after the extraction. In a 60-second virtual timeline it starts visible, polls at 15 seconds, remains hidden from 15 to 45 seconds, resumes with visibility/focus signals at 45 seconds, and polls again at 60 seconds.

- Before request timestamps: **0, 15, 45, 60 seconds**.
- After request timestamps: **0, 15, 45, 60 seconds**.
- Hidden requests: **0 before and after**.
- Additional requests during the subsequent inactive/unmounted checks: **0 before and after**.

This establishes scheduling equivalence for the controlled workload, not network latency or CPU improvement. Existing in-flight guards already suppress the simultaneous party focus/visibility burst. No request reduction is claimed, and this is not a browser/background-tab throttling benchmark. Further coalescing should wait for a demonstrated redundant workload.

### Verification and limits

- Six lifecycle tests cover the first 15-second tick without an extra initial read, hidden/resume signals, timer-only 3-second cadence, notebook signal opt-out, unmount/remount cleanup, and server rendering without browser globals.
- Five tests of the real party composable cover the timed trace, in-flight focus/visibility signals, saves with superseded responses, revoked access, and stale responses after switching rooms.
- Maps/notebook/room refresh and dirty-draft guard bodies remain unchanged; their complete editing workflows were not newly exercised in a browser. This batch is a small scheduling extraction, not approval to change their cancellation or save behavior.
- Final website suite: **462 passed, 54 existing opt-in skips, zero failures**. Frontend typecheck/build and server typecheck passed. All 19 generated CSS assets match the original first-batch build hashes, totaling 336,332 bytes.
- No live requests or database writes were used for this polling workload. This batch remains uncommitted and undeployed.

Before/after traces, source snapshots, the final test report and CSS fingerprints remain in ignored `.local/polling-20261027/`. Repeat the scheduling check from the repository root with:

```powershell
node scripts/benchmarks/polling-lifecycle.mjs check
```

The runner compares the emitted request trace with the retained pre-change baseline. It refuses to overwrite the existing `before` label. Without the local evidence directory, establish a baseline on the original source before comparing another candidate.

## Fourth batch: full-library replacement and recency, local only

At four-owner capacity, rebuilding an already cached owner previously evicted the oldest owner before replacing the existing entry. When these were different owners, the cache dropped to three entries and retained the rebuilt owner's old position in the eviction order. This caused unnecessary later source reads and library reconstruction.

`server/lib/workshop-library.ts` now removes the replaced key after a successful build, before checking capacity and inserting the fresh value. A replacement therefore consumes no additional slot and becomes the most recent entry. A new fifth owner still evicts the least recently used owner. Revision checks, in-flight sharing, failed-build handling and parsing/catalog/rule construction are unchanged.

### Controlled timings and rebuild counts

AMD Ryzen 7 5800X3D, Node v26.8.2. Each version ran in five fresh Vitest workers without other tests or builds alongside it. Seven fictional owners each supply one deterministic 191,938-byte pack containing 300 spells and 16 races. Database revision/source reads are stubbed; the actual EDN parser, parsed-pack cache, catalogue builder and character-rule builder run. Timings include the library request and exclude output hashing, forced garbage collection, database/network access and process startup.

| Affected request | Before median ms | After median ms | Source loads per request, before/after |
| --- | ---: | ---: | ---: |
| Read A after filling A/B/C/D and revising C | 1.2668 | 0.0296 | 1 / 0 |
| Read C after filling A/B/C/D, revising C, then reading E/F/G | 1.1933 | 0.0292 | 1 / 0 |

All five samples reproduce each avoided rebuild. Before/after ranges are 1.1788–1.2931 / 0.0285–0.0354 ms for A, and 1.1521–1.4643 / 0.0288–0.0364 ms for C. The first scenario's four follow-up requests improve from three hits and one rebuild to four hits; the second improves from four rebuilds to three rebuilds and one hit. Required C revision rebuilds still occur in both versions. Parsed source is already warm on the avoided rebuilds, so this isolates catalogue/rule reconstruction rather than cold parsing.

A separate 13-request control without revision changes produces the same 12 hits and one genuine eviction/rebuild in both versions. Total control time is 7.9327 / 7.6060 ms median before/after; no speed benefit is attributed to this small difference. The established benefit is avoiding the two incorrect rebuilds, approximately 1.2 ms of local work each on this fixture. These are not HTTP or production website loading measurements; neither the frequency of this traffic pattern nor the cost for real large libraries has been established.

### Memory tradeoff and byte-budget decision

The fixed cache retains four owners immediately after a replacement where the bug retained three. In the first scenario, whole-worker heap after forced GC at that point is 21.15 / 21.38 MiB median before/after, an increase of approximately 0.23 MiB on this fixture. RSS at the same point is 101.14 / 101.05 MiB; it does not show a useful reduction. Full raw heap, RSS and process high-water RSS observations are retained for every scenario. They include fixtures, Vitest, module state and shared parsed-pack objects, so they are not per-cache byte sizes or a production peak-memory guarantee.

Retaining the intended fourth library can cost considerably more for larger owners. The four-owner maximum is unchanged, but it is not a byte limit. This is an explicit reuse/memory tradeoff; no memory-reduction claim is made. Adding full-library or browse byte budgets remains deferred until representative large-owner sizes and access traces support a policy. The existing parsed-pack and focused-rule byte budgets are unchanged.

### Verification and repetition

- Four regression tests cover replacement freshness, unrelated warm-owner retention, recency, four-owner eviction, owner isolation, normal warm-read recency, concurrent load sharing and failed-build retry. Two failed against the original source and all four pass after the fix.
- All **175 before/after library-output hashes** match across five paired samples. Hashes cover source documents, packs, catalogue, rules, initial drafts and warnings for every measured request.
- Website suite: **466 passed, 55 skipped, zero failures**. The additional skip is this new opt-in benchmark. Server typecheck and `git diff --check` pass; the latter reports only existing CRLF notices. No frontend runtime or styles changed in this batch, so its build was not repeated.
- The four protected extension files retain their starting hashes for this batch, including the already modified API. No hosted request, database connection/write, deployment, commit or push was performed. The earlier deployment hold remains in effect.

The opt-in harness is `scripts/benchmarks/workshop-cache-performance.test.ts`. Ignored `.local/workshop-cache-2026-10-27/` retains the original library source/hash, ten raw measurement files, output equivalence and timing/memory comparison, protected-file checks and test/typecheck logs. Measurement files use exclusive creation and cannot overwrite an existing label.

For a new paired comparison, preserve this evidence and establish `before-N` on the original source, then `after-N` on the candidate, for N=1 through 5. The recorded command shape was:

```powershell
$env:WORKSHOP_CACHE_BENCHMARK_LABEL = 'after-1'
node node_modules/vitest/vitest.mjs run scripts/benchmarks/workshop-cache-performance.test.ts --execArgv=--expose-gc --reporter=dot
```

The existing labels are deliberately occupied. An after run checks all output hashes against its matching before run before writing evidence. Without the original baseline, do not compare the optimized code against itself.

## Git handoff: clean-snapshot verification

The user authorized pushing the reviewed work and continuing locally. Commit `8c4efaa` contains the first four optimization batches, including their tests and audit. It excludes the unrelated local authentication edits in `server/extension/approval-page.ts`, `models.ts` and `production-trial-config.ts`; the API commit includes only the focused-library import/call. A merge preserves the remote branch's newer README cleanup without rewriting history.

A separate clean worktree of the exact merge candidate passes the frontend typecheck/production build. Its full website suite reports **465 passed, one failed and 55 opt-in skips**. The failure is the existing production-trial test expecting `rememberedConnections:false` while the committed runtime returns `gameSessions:false`. The pre-optimization commit `d754c5d` reproduces that same assertion failure. Server typecheck reports **12 diagnostic locations** in the clean candidate, exactly matching the original commit, for the existing mismatch between committed remembered-auth modules/tests and the older model/config/API interfaces. No new diagnostic is introduced by these optimizations.

The earlier 466-pass suite and successful server typecheck describe the dirty local checkout, which includes those unfinished authentication edits; they do not describe the clean pushed snapshot. Authentication work is deliberately preserved locally rather than bundled merely to make unrelated checks green. The exact optimization tests pass in the clean snapshot. This Git handoff is not deployment approval, and the separate hosted Owlbear initialization blocker is unresolved.

Ignored `.local/optimization-push-20261027/` retains the source patch, protected-file hashes, exact-candidate suite/build/typecheck logs and original-commit comparison. The initial baseline test command used an incorrect relative config path and failed at startup; its corrected run uses the absolute current Vitest config and reproduces the assertion above. No production request, deployment or database operation is part of this handoff.

The Git push completed after the user signed into Git Credential Manager: remote `codex/folio-sheet-rollout` was verified at `71dc4d0adf9f641f2d432e3b17d452ef219561a3`. All four protected local working files retain their starting hashes. This records a Git push, not a Vercel promotion.

## Fifth batch: plugin packaging investigation, skipped

**Skipped at the user's request on 28 October.** The plugin's App.vue has been restored byte-for-byte to its pre-investigation source, verified against the saved baseline SHA-256. No runtime packaging change remains, and nothing from this candidate was deployed. The following measurements describe the discarded candidate.

The next audit item was investigated in the independent sibling `owlbear-character-sheet` repository. The candidate changed `src/App.vue` to defer the fictional SheetContent through Vue's async component loader. The map rehearsal remained eager, as did the demo data/state that currently supply shared shell settings. Connection, permission, session, window/drag, CSS, build-tool and dependency inputs were unchanged. No website runtime change was part of this batch.

The production-game-session initial JavaScript entry falls from **239,383 to 233,055 bytes**, saving **6,328 bytes (2.64%)**. Node's default `gzipSync` reduces the same entry from **70,853 to 69,498 bytes**, a 1,355-byte saving; this is not hosted wire compression. All emitted JS grows by 3,670 bytes to 243,053 because of chunk/bootstrap overhead, including the deferred 9,998-byte sample view. CSS is identical at 45,503 bytes. Production browser checks fetch only the main entry, including while using settings and expand/compact and attempting to force demo through the URL.

Five fresh isolated Edge 155.0.4283.62 contexts per build/profile used local uncompressed HTTP without network/CPU throttling. Navigation-to-production-connection-screen medians are **33.2/32.0 ms** before/candidate in the first batch and **33.1/38.4 ms** in a separate timing batch: no reliable production speed improvement is established. Rehearsal map readiness remains **31.3/31.0 ms**. First fictional-sheet rendering after clicking Open costs **11.6/38.9 ms**, approximately 27.3 ms extra locally for the deferred request; slow networks may cost more. The measured benefit is only a smaller initial production download, with an explicit demo-loading and total-package-size tradeoff.

Four screenshot hashes match exactly across production/rehearsal desktop and 390px mobile views. Browser checks also preserve settings, prior fictional HP/notes/layout, spell display, compact/expanded views, sample/connected switching and launcher behavior. All 93 plugin tests, typecheck and direct Vite builds for ordinary rehearsal, production-game-session, read-only, play-controls, remembered and shared-test profiles pass. Runtime/config/dependency hash checks identify only App.vue as changed. Hosted calls are blocked, with zero attempted external requests or page exceptions. Authenticated reads/saves, actual Owlbear host behavior and physical/slow-network gameplay remain unverified.

The initial browser harness had an incorrect selector and was corrected before capturing its baseline. A broader intermediate split deferred the map too, saving more bytes but increasing local map readiness to 49.6 ms; the final candidate keeps the map eager. No deployment tool or frozen release stage was rerun.

The source candidate was **local and uncommitted in the independent plugin** and has now been reverted. Its existing scaffold and other work were preserved and were not bundled into the website's Git push. Historical details are in the sibling `docs/LOCAL_PACKAGING_20261027.md`; source snapshot, before/intermediate/final builds, browser results/screenshots, click timings, comparison, restoration record and check logs remain in its ignored `.local/packaging-20261027/`. Work spanned local midnight into 28 October; the evidence directory retains its starting date. No account approval, character write, database operation or deployment was performed.

## Sixth batch: website startup, 28 October, local only

**Reverted at the user's request.** The 4,945-byte compressed startup saving did not demonstrate a reliable overall loading-time improvement and imposed a first-use delay. DashboardView has been restored to its original imports. The following measurements describe the discarded candidate.

DashboardView previously imported CharacterLinkImport eagerly even though its panel is mounted only after clicking Import character link. The dashboard now uses Vue's async component loader for that panel, with immediate loading status and an error message. The loaded component remains mounted when the drawer closes, preserving entered URLs and previews. Dashboard routing, authentication, save/import handlers and CSS source/order are unchanged.

### Download measurements

Production Vite manifests define the initial closure as index.html plus recursive static imports, excluding dynamic imports. Compression below is the sum of Node's default gzipSync output per asset, also served by the local fixture server; it is not a measurement of Vercel's compression or caching.

| Initial assets | Before bytes | After bytes | Reduction |
| --- | ---: | ---: | ---: |
| JavaScript, uncompressed | 194,197 | 181,022 | 13,175 (6.78%) |
| JavaScript, gzip | 71,313 | 66,963 | 4,350 (6.10%) |
| CSS, uncompressed | 145,597 | 141,822 | 3,775 (2.59%) |
| CSS, gzip | 24,803 | 24,208 | 595 (2.40%) |

Login and the unselected dashboard retain four JavaScript requests and one CSS request, and do not fetch the import panel. Direct-sheet loading also needs the shared calculation chunk: its recorded complete JavaScript download falls only from 154,698 to 153,181 gzip bytes and uses ten JavaScript requests instead of nine. No additional request latency is established in the measured sheet workload, but a smaller initial closure is not the same as the same saving on every route.

All emitted JavaScript grows from 1,234,767 to 1,236,038 uncompressed bytes, or 375,863 to 377,486 gzip bytes, because of chunk boundaries and the loading/error UI. Total emitted CSS changes from 336,332 to 336,333 bytes after splitting/minification. This is deferral of optional code, with modest package overhead; it does not remove the import feature.

### Controlled DOM-readiness timings

Five paired fresh document navigations per build/scenario/profile, alternating before/after order, ran without concurrent tests or builds. The native preview uses Electron 44.9.3 / Chrome 152.0.7977.167 on this machine. Both builds use loopback HTTP, gzip, Cache-Control: no-store and identical fictional API responses. Samples share an incognito browser process, so this is not a cold-process/CPU-cache benchmark. There is no bandwidth or CPU throttling. The second profile adds 80 ms independently to every server response, including HTML/assets/API; it is a controlled latency model, not a mobile network simulation.

The measurement starts at document navigation and stops when a MutationObserver sees the login email input, loaded dashboard browsing hint, or saved-sheet heading. These are DOM markers, not painted readiness, FCP, LCP or an authenticated production speed guarantee. The background native preview's animation/screenshot behavior was unsuitable for visual timing; painted timing is deliberately not reported.

| Route | Loopback before/after median ms | +80 ms per response before/after median ms |
| --- | ---: | ---: |
| Signed-out login | 51.1 / 41.0 | 288.8 / 287.6 |
| Signed-in dashboard, roster loaded | 59.3 / 56.3 | 373.3 / 377.6 |
| Signed-in saved sheet | 87.5 / 84.9 | 573.3 / 573.9 |

The ranges overlap substantially; **no reliable overall loading-time improvement is established**. The demonstrated benefit is avoiding 4,945 gzip bytes of initial JavaScript/CSS on login and the dashboard. Real benefit on constrained connections remains unmeasured.

First link-import panel DOM readiness costs 2.5 / 16.8 ms median before/after locally, and 1.8 / 92.0 ms with the 80 ms response delay. The final panel fetches its JavaScript, a shared calculation chunk and scoped CSS in parallel. Reopening preserves the fictional preview and URL, restores close-button focus to the dashboard toggle, and makes zero additional requests. Thus the retained candidate explicitly trades a first-use delay on an optional panel for a smaller normal startup download. It is not drawback-free.

### Discarded whole-dashboard candidate

Making DashboardView a lazy route reduced initial JavaScript by 50,829 raw / 15,906 gzip bytes and CSS by 21,120 raw bytes. It added a request after the authentication guard: dashboard readiness rose from 65.4 to 81.6 ms median locally and from 385.2 to 468.7 ms with the response delay. This imposed a measurable cost on the main landing page, so the router was restored to its original source. Its separate builds and raw measurements are retained; none of that candidate remains in the application.

### Behavior checks and limits

- Separate isolated Edge browser contexts verify login, dashboard, open import panel and saved sheet at 1440 px and 390 px. All eight before/after full-page screenshot pairs have identical SHA-256 hashes, with no horizontal overflow, page exceptions or external requests. Reduced motion and loaded fonts make those visual comparisons deterministic. A first native screenshot attempt timed out and its viewport did not consistently match evaluation; the isolated Edge run supplies the visual evidence, not the timing table.
- Fictional import preview, close/reopen state and focus restoration pass in both builds at both widths. Signed-out sheet URLs retain the login next parameter; signed-in login redirects to the dashboard.
- Deliberately returning 503 for the import chunk displays the panel error and existing page-load recovery notice while leaving the roster usable. A delayed response displays the loading status. No real character creation, hosted API call, database operation or save is part of these checks.
- Frontend typecheck/production build passes. The local suite reports **466 passed, 55 opt-in skips, zero failures**. This is the dirty local checkout containing preserved unfinished authentication work; the earlier clean-commit test/typecheck caveat still applies. No server source is changed by this batch.
- All protected source hashes match the starting snapshot, including the four existing authentication files and global/sheet styles. The only application edit is DashboardView.vue. No commit, push, deployment or live promotion was performed; the hosted Owlbear initialization hold remains unresolved.

Ignored `.local/website-loading-20261028/` retains original/candidate/final production builds, source/hash snapshots, raw paired DOM and panel-open timings, exact probe expression/method, fixture server, asset/timing summary, isolated browser verification script and sixteen screenshots, and validation logs. The fixture server binds only to loopback and supplies fictional characters/references. Run `node .local/website-loading-20261028/serve.mjs` to inspect the retained before build on port 4317 and after build on port 4319. Summary and browser verification outputs use exclusive creation to preserve evidence.

## Seventh batch: smaller character-sheet loading, 28 October, local only

The user requested reverting the small import-panel split and pursuing larger benefits. DashboardView is restored to its original source, verified by its empty Git diff and protected hash. The new baseline therefore includes the original eager link importer.

Source maps and manifest traversal identified two sizeable costs on the ordinary sheet path: the permanent editor was imported eagerly, and the equipment tab imported the item creator even when its dialog was closed. Inventory's itemSearchText helper also imported the full filter metadata module, keeping a large catalogue in the ordinary sheet graph after an initial split attempt.

The retained candidate changes these loading boundaries:

- CharacterEditTab loads on its first use, with immediate loading status and a failure message. Its draft, validation, save and unsaved-change handling remain intact.
- Both sheet entry points use DeferredItemComposer. The wrapper forwards the original props and events, shows loading/failure status, and allows cancellation while loading. An unmounted wrapper cannot open the dialog when its pending import finishes. A shared type-only props interface keeps the wrapper and actual creator aligned.
- Inventory search uses a small item-search module backed by a separate item-forms.json containing the original weapon/armour forms. The larger per-item filter data remains with the catalogue tools. The compatibility export from magic-item-filters is preserved, and its generator now writes both metadata files. All original metadata reconstructs exactly from the two files; no item rules or catalogue entries are removed.

### Download and package sizes

These measurements traverse each production manifest's recursive static imports. The sheet total includes index.html's JavaScript and the CharacterSheetView dependency graph, excluding unrequested dynamic tools. Compression is Node's default gzipSync per file, also used by the local server. Fonts, HTML, API responses and HTTP headers are excluded from this table.

| Ordinary sheet assets | Before bytes | After bytes | Saving |
| --- | ---: | ---: | ---: |
| JavaScript, uncompressed | 516,326 | 342,142 | 174,184 (33.7%) |
| JavaScript, gzip | 154,698 | 119,629 | 35,069 (22.7%) |
| CSS, uncompressed | 172,510 | 166,701 | 5,809 |
| CSS, gzip | 31,479 | 30,250 | 1,229 |

The ordinary sheet avoids **36,298 compressed JavaScript/CSS bytes** before either optional tool is requested. Its static graph still uses nine JavaScript and five CSS requests. The sheet editor and item creator do not appear in the ordinary-sheet static closure. API/authentication sequencing and requests are unchanged.

There is a package tradeoff. All emitted JavaScript grows from 1,234,767 to 1,238,299 raw bytes, or 375,863 to 379,923 gzip bytes, because separate chunks compress less efficiently and include loading/cancellation UI. Total emitted CSS changes from 336,332 to 336,335 bytes after splitting/minification. Global CSS sources are unchanged. The dashboard/login initial closure grows by 221 raw / 97 gzip JavaScript bytes to carry chunk-preload metadata; its CSS is byte-identical. This batch targets opening sheets, with no dashboard startup speed claim.

### Timed browser results

Five paired samples per build, route and network profile ran in alternating before/after order, using fresh isolated Edge contexts at 1440×1000 with reduced motion. No build or test ran alongside the timings. Both builds use gzip, Cache-Control: no-store, the same loopback fixture server and the same fictional saved characters/API responses. No hosted calls or database access are involved.

The constrained profile uses Chromium network emulation with 80 ms latency, 200,000 bytes/sec download (1.6 Mbit/sec) and 100,000 bytes/sec upload. CPU is unthrottled. The local profile has no artificial network limits. Values measure navigation to a DOM marker for the loaded roster or saved character heading, rather than a production web-vitals result. Reference completion and loaded fonts are awaited before collecting resources or testing first-use controls.

| Navigation | Local before/after median ms | Constrained before/after median ms |
| --- | ---: | ---: |
| Dashboard roster | 70.8 / 73.7 | 949.3 / 963.8 |
| Direct saved sheet | 104.2 / 103.6 | **1,590.5 / 1,391.1** |
| Dashboard opening a requested sheet | 122.8 / 124.7 | **1,975.1 / 1,725.7** |

Constrained direct-sheet readiness improves by **199.4 ms (12.5%)**, with non-overlapping sample ranges of 1,568.7–1,594.5 before and 1,381.6–1,411.7 after. The embedded sheet improves by **249.4 ms (12.6%)**, with ranges of 1,960.5–1,994.3 / 1,705.9–1,735.5 ms. Local differences overlap and provide no meaningful speed claim. Dashboard-only differences also overlap; the byte increase there is explicitly recorded above.

These results establish a useful constrained-download improvement for the controlled sheet workload. They do not establish actual Vercel response times, mobile CPU performance, cold server startup, or gains for every character/account/network. The large server/database and reference-resolution costs remain separate measurement targets; fictional responses cannot establish those bottlenecks.

### First-use cost and behavior verification

| First tool opening, click to DOM readiness | Local before/after median ms | Constrained before/after median ms |
| --- | ---: | ---: |
| Character editor | 10.8 / 18.9 | 10.8 / 228.2 |
| Item creator from Equipment | 15.1 / 21.5 | 14.7 / 227.3 |

The first editor/item opening therefore costs approximately **217 / 213 ms extra** under the constrained profile, and **8 / 6 ms extra** locally. People who immediately edit or create an item may spend the initial saving on that first tool request. Loaded modules remain cached within the document. This tradeoff is retained for the larger benefit to normal sheet reading/play; it is not described as drawback-free.

- Sixteen full-page screenshot pairs have identical SHA-256 hashes: dashboard, combat, equipment, editor, item dialog, embedded summary and player champion sheet at 1440 px and 390 px, plus the folio theme at both widths. All normal checks have no page exceptions, unexpected HTTP failures, external requests or horizontal overflow.
- Inventory search still finds a renamed rapier through its physical form and excludes a nonmatching search. Player views still omit permanent edit and item-giving controls.
- Both builds preserve draft text when a tab change is cancelled and when a route-leave prompt is dismissed. Adding an item to a draft makes no fixture write until Save character. Saving that draft and giving an item immediately both work. Before/after save request payloads match at both widths, after normalizing the deliberately random item-giving idempotency token. All writes are to in-memory fictional fixtures.
- Delaying each deferred tool by 800 ms displays loading status; cancelling or switching back to combat prevents a later dialog/editor mount. Deliberately returning 503 shows recoverable error UI and allows returning to the sheet without a write.
- **53,339 comparisons** against the original filter module preserve item search, magic-item bases, membership and filter outcomes across 87 filter cases and the bundled catalogues. The split metadata reconstructs the original exactly, and the updated generator reproduces the new form file from the bundled SRD.
- Frontend typecheck, standard production build and the full local suite pass: **466 passed, 55 opt-in skips, zero failures**. The local suite still includes the preserved unfinished authentication work; the earlier clean-commit server test/typecheck caveat remains applicable. No authentication or server source was changed by this batch.

The first timing harness attempt used a DOM marker that became inapplicable when the dashboard removed its character query; it was corrected before the complete retained paired run. An initial browser workflow check used the wrong Add-to-draft button label; its corrected complete run passes. A first equivalence-loader attempt scanned archived browser-profile files and was stopped; the completed run disables dependency discovery and filesystem watching. These harness issues did not require application fixes.

Ignored `.local/sheet-loading-20261028/` retains baseline/intermediate/final builds with hidden source maps, source and protected-file snapshots, fixture server, 80-context timing runner and raw results, visual/workflow verifier and 32 screenshots, metadata-equivalence/generator evidence, summary, and check logs. Outputs refuse to overwrite completed measurement labels. The static server uses only 127.0.0.1 ports 4327 (before) and 4329 (after), with in-memory fictional API state. It has been stopped after verification.

This candidate is local and uncommitted. No push, deployment, production request or database write was performed. The four pre-existing authentication edits retain their starting hashes, the plugin packaging work remains skipped, and the separate hosted Owlbear initialization hold remains in place.

# Intent-based loading experiment — 28 October 2026

## Decision

Asset preloading on sustained hover or keyboard focus is possible, but it is a secondary improvement for this site's loading problem. A controlled half-second hover reduced post-click readiness by approximately **317–338 ms** on the constrained profile. Ordinary loopback differences were approximately **7–18 ms**. No multi-second improvement was established.

The experiment remains under ignored `.local/intent-prefetch-20261028/`. No application implementation, commit, push or deployment is retained from this experiment. The accepted creator cache and unrelated edits remain unchanged.

## Existing behavior and calculation before implementation

The router already splits Compendium, character creation and the character sheet into lazy modules. The dashboard also defers its embedded sheet. There is no general navigation hover/focus preloader. Existing rule/feat hover handlers serve tooltips.

For a request starting after a 180 ms intent dwell, a click 500 ms after intent gives `500 - 180 = 320 ms` of head start. A 2.5-second focus pause gives `2,500 - 180 = 2,320 ms`. Request prefetch cannot hide more of that request's latency than its actual head start. These are scenarios, not measured user hover durations. Users should not be asked to pause deliberately.

Asset-only warming does not start the component's setup or mounted hooks, so it does not start catalogue, browse or character requests earlier. It can remove the asset delay before those requests begin. Prefetching data as well would move database work earlier and could waste it on abandoned intent; it would not reduce the underlying database time.

The previously measured 10,750 ms creator application miss and approximately 320 ms metadata validation expose about `10,750 - 320 = 10,430 ms` of potentially avoidable server work on an unchanged, revision-validated repeat visit. That remains a calculation, not a hosted browser-cache-candidate result. It is a substantially larger opportunity than these measured asset savings. See [server loading profile](server-loading-profile-2026-10-28.md).

## Method

The current checkout was copied to an ignored diagnostic source tree and production-built with Vite. Only that copy received a global hook invoking the router's actual lazy component loaders. A browser probe attached a one-shot hover/focus listener with a 180 ms timer to the Compendium link, New character button or character roster button. No production event handlers were added.

The benchmark follows the existing isolated Edge workflow in `.local/sheet-loading-20261028/measure.mjs`: Edge 155.0.4283.62, five fresh contexts per scenario/variant/network, alternating variant order, 1440 × 1000 viewport, reduced motion, no CPU throttle. Ninety navigation trials completed. External URLs were blocked; interception disables ordinary HTTP caching, but same-document module reuse remains active. Static JavaScript/CSS were gzip-compressed. Tests began on the dashboard after its character roster and fonts were ready.

All APIs were fictional, loopback-only fixtures: one character, one spell-list row and empty imported creation definitions. The route's principal data response had a fixed **350 ms** server delay. No real MongoDB, Atlas, hosted account or live API was contacted. These tests isolate the asset-navigation opportunity; they do not reproduce the user's 126-pack library or forecast production totals.

Constrained network: 80 ms configured latency, 200,000 download bytes/second and 100,000 upload bytes/second, through CDP. Ordinary loopback was also tested. Readiness means the first populated Compendium result, the ready creator fieldset, or the sheet's character heading. Supplemental sheet reference completion is not part of sheet readiness.

## Timed results

Median post-click milliseconds; five samples per cell:

| Network | Destination | Immediate click | 500 ms hover | 2,500 ms focus |
| --- | --- | ---: | ---: | ---: |
| Loopback | Compendium | 394 | 379 | 379 |
| Loopback | Creator | 418 | 411 | 396 |
| Loopback | Embedded sheet | 408 | 390 | 391 |
| Constrained | Compendium | 904 | 581 | 395 |
| Constrained | Creator | 940 | 623 | 503 |
| Constrained | Embedded sheet | 839 | 500 | 408 |

Constrained half-second-hover savings from unrounded medians: **322 ms**, **317 ms**, **338 ms**. Focus savings: **509 ms**, **437 ms**, **430 ms**. Differences of independently calculated medians and scheduling/measurement noise need not equal the nominal head start exactly.

Constrained immediate-click ranges: Compendium 886–905 ms, creator 929–954 ms, sheet 820–852 ms. Hover ranges: 575–590 ms, 610–631 ms, 498–515 ms. Full samples and the elapsed time including the simulated intent pause are in `results.json`. The table excludes that pause: it demonstrates hidden waiting, not an equivalent reduction in total time since the user began interacting.

## Costs and failure checks

Across all ninety trials, speculative asset loading started **zero API requests**. Clicking still made exactly one principal data request. Concurrent calls to the same route loader shared asset requests rather than downloading each JavaScript/CSS asset twice. All normal navigation trials had no captured browser errors.

The assets fetched after dashboard readiness were identical between variants:

| Destination | Additional gzip JavaScript + CSS body bytes | Requests |
| --- | ---: | ---: |
| Compendium | 71,463 | 12 |
| Creator | 61,334 | 10 |
| Embedded sheet | 54,442 | 11 |

These bytes move earlier for a completed navigation. On abandoned intent they are speculative cost; already-started dynamic imports cannot be reliably cancelled. Shared assets may help later navigation, so these are per-destination measured totals, not additive totals for all destinations.

A separate deliberate failed-chunk check confirmed that calling the existing dynamic loader speculatively can display the current **Page loading recovery** banner even though the user remains on the functioning dashboard. Catching the import promise does not prevent Vite's earlier preload-error event from updating the banner. No forced reload occurred. This is a concrete drawback to simply adding `@mouseenter="loadPage()"`.

A production candidate would need bounded/cancellable intent timers, keyboard equivalence, touch/Save-Data/slow-network guards, request sharing, and separation of speculative failures from actual navigation failures. It must preserve existing navigation recovery and unsaved work. Prefetching CSS also advances stylesheet attachment; current-page visual effects would need checking. Those features were not implemented or claimed verified by this prototype.

## Next priority

Prioritize authenticated, revision-validated Compendium page persistence for repeat visits, with exact owner/category/search/filter/page/version keys. The current 30-second in-component memory cache is lost when the view unmounts. A persistent candidate must validate with the server before displaying stored data, invalidate on edits/imports/deletes/account transitions, reject offline/401 fallback, bound storage and reject corrupt records. It must avoid rebuilding the full category merely to validate a cache tag.

For first visits, continue reducing prepared database delivery and unnecessary data reads. Hover is a finishing improvement after those costs fall. Do not move awaited cache writes into untracked serverless promises as a shortcut.

## Evidence and verification

Ignored evidence: `prepare.mjs`, diagnostic `source/` and `build/`, `serve.mjs`, `bench.mjs`, `results.json`, `checks.mjs`, `checks.json`, and logs under `.local/intent-prefetch-20261028/`. The build passed; all ninety timing scenarios and both success/failure checks passed. This was a diagnostic build, not a full checkout typecheck/test rerun. No application source changed, so no new application-test result is claimed.

All six previously protected file hashes and all eight retained creator-candidate hashes match their recorded baselines. `git diff --check` passed with the existing CRLF warning. The local fixture contains no production data and creates no database. No commit, push, deployment, infrastructure setting or billing change occurred.

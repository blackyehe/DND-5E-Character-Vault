# Automatic Compendium preparation — verification and release, 2026-10-29

Published to https://dndoldal.vercel.app on 2026-10-29 after local and authenticated hosted verification. No database migration or production content edits were performed. Git commit/push remains blocked by unrelated baseline differences described below. The earlier character/editor/import-validation findings remain queued in [the previous audit](character-compendium-player-audit-2026-10-29.md).

## Behaviour

- The authenticated application prepares all 15 browsing indexes automatically after 1.5 seconds of idle time, with one category at a time and a one-second gap between categories. This includes equipment, magic items, classes, subclasses, and every other Compendium category.
- Opening a category prioritizes it. Foreground API requests, response-body parsing, creator-options loading, and navigation pause/abort preparation before foreground fetches start. Preparation resumes after idle time. Hidden tabs, offline mode, and active room routes also pause preparation.
- The manual save button is removed. Following the requested UI cleanup, one header dropdown shows overall verified progress, all category availability states and preparation retry controls. Duplicate panels in the Compendium and imported item picker have been removed. The current result source remains tracked internally.
- Browsing and maintenance have separate workers. Atomic worker browse commands prevent interleaved category changes from returning the wrong category. Disk opening overlaps authenticated revision validation within the existing 1.5-second server-fallback budget.
- Web Locks coordinate preparation between tabs. Browsers without that capability retain server browsing rather than starting duplicate exports.
- Saved hints alone never mean “available.” Owner, format, checksum, structure, disk age, and authenticated server revision still gate eligibility. Missing, corrupt, expired, and stale indexes are repaired automatically. A committed index whose marker was interrupted is recovered without another export.
- Session expiry suspends cache access. A subsequently verified login to the same account reuses its stored indexes. A different owner clears the previous scope, and explicit logout removes the device library. Generation and abort checks reject late old-account results.
- Library mutations invalidate eligibility and schedule refreshes; an idle queue also rechecks saved categories periodically. Failures use bounded backoff and do not prevent the remaining categories from being prepared. Evicted categories are removed from the saved marker and skipped to avoid a storage-budget download loop.

Server authority, full-detail requests, character writes, room permissions, and room polling were preserved. This caches browsing indexes; it does not implement offline editing or download every full description/artwork asset. Existing limits remain 8 MiB per category, 24 MiB total, 30,000 records per category, seven-day disk age, and 30-second authenticated revision eligibility.

## Measured costs and timings

The comparison used the frozen live source at commit `9d2c605` and an explicitly allowlisted candidate. All 385 saved source files were hash-checked before copying; unrelated dirty extension/editor changes were excluded. The final candidate allowlist contains 18 runtime files, including the small category-list module that avoids loading filtering datasets at login.

Desktop Edge `155.0.4283.62` ran real workers, IndexedDB, and Web Locks against captured 126-pack indexes. Authentication was fictional. The loopback test server imposed 120 ms on browsing-page responses and 60 ms on exports. These are controlled local measurements, **not new measurements of the hosted database or internet connection**.

| Observation | Result |
| --- | ---: |
| Automatic preparation of all 15 categories from dashboard | 18,223 ms |
| Total browsing records across those indexes, including base content | 15,017 |
| Payload bytes stored | 12,413,359 B (11.84 MiB) |
| Compressed snapshot response bodies | 1,623,942 B (1.62 MB) |
| Maximum simultaneous exports, including two-tab test | 1 |
| First Compendium open after dashboard preparation | 144 ms |
| First prepared monster-category open | 218 ms |
| Untouched live frontend, unsaved monster-category opens | 348 / 338 / 233 ms |
| Repeat monster opens from recent page memory | 24 / 27 ms |
| Reload using the retained device library | 141 ms; zero redundant exports |
| Foreground navigation while background export was stalled | 250 ms; stalled export aborted |
| Selected category automatically refreshed after a mutation | 1,988 ms |

The first prepared monster open removes 120 ms from the 338 ms comparison median (35.5%) in this deliberately fast local server fixture. The earlier hosted multi-second findings are not being relabelled as new results. The practical benefit of this change is preparing indexes before the user visits the Compendium and reliably reusing them; a hosted performance check remains necessary before claiming a new hosted speedup.

The compressed bodies alone take about `1,623,942 × 8 / 3,000,000 = 4.33 seconds` at 3 Mbps, or 1.30 seconds at 10 Mbps. That excludes database work, request latency, worker processing, and deliberate idle gaps. The measured 18.2-second preparation is background work, not a blocked page load. Opening the Compendium immediately after login can still use the ordinary server path while its category is unprepared.

Summed gzip sizes of the initial JavaScript scripts/preloads rose from 74,996 B to 76,922 B: **1,926 B additional compressed JavaScript**. The full filter/equipment datasets remain outside the login preparation module.

## Verification

- Production builds pass for the workspace and the isolated candidate; server TypeScript checking passes.
- Full suite: **571 passed, 55 skipped, zero failures**. Machine-readable results are stored in `.local/automatic-compendium-20261029/final-tests.json`. HTTP tests require loopback access outside the sandbox; the initial sandboxed run failed on `connect EACCES`, and the unrestricted rerun passed.
- Desktop recovery scenarios passed: automatic dashboard preparation; saved-disk reload; missing/corrupt disk repair; missing-marker recovery without re-export; same-owner reauthentication; mutation refresh; foreground interruption and resumption; two-tab coordination with exactly 15 exports; offline pause/resume; active-room pause with zero room exports; blocked-worker server fallback.
- Each of the 15 categories was opened through the desktop category controls and checked against the captured source count, with device-index results and no server browsing-page request. Magic items opened in 123 ms and monsters in 218 ms in that category pass. This checks category browsing, not every full-detail entry again.
- An additional desktop logout check confirms that the actual Log out button clears both the marker and the IndexedDB library.

Evidence is ignored local material under `.local/automatic-compendium-20261029/`: source audits, isolated builds, `summary.json`, `candidate-r2-evidence/browser-results.json`, `candidate-r2-categories/browser-results.json`, screenshots, and test output. No private imported entry contents or credentials are included in this report.

## Remaining limits

1. The server revision is still whole-library scoped. A library change can require replacement of all category snapshots; this is not per-entry delta synchronization. Unchanged saved categories are checked without repeated exports.
2. Aborting the browser fetch cannot guarantee cancellation of database work already running on the server. Sequential exports and idle gaps reduce overlap; they do not eliminate first-download work.
3. Cleared/evicted browser storage must be rebuilt. If the library exceeds the existing device budget, server browsing remains available and the queue avoids continuously replacing evicted categories.
4. Preparation intentionally pauses inside an active room. Its imported item picker can use already prepared indexes or the existing authenticated server path.
5. Hosted functionality has passed, but no new precise hosted speedup has been measured. The timings above remain controlled local results.

## Hosted verification and release

- Deployment: `dpl_HWkJw9C7Ac5AnnjSizpNQQnQQWVb`, reviewed at https://dndoldal-hruqs156h-dndenjoyerstudio.vercel.app. Its 389 deployed source files exactly match the reviewed release manifest; the exact package also passes server TypeScript checking.
- Authenticated hosted checks on the user's actual library confirmed automatic preparation of all 15 categories from the dashboard, device-index browsing for spells, magic items and monsters, magic-item search, and reuse after a page reload. These checks did not edit library or character data.
- The public alias was verified pointing to this deployment. Public HTTP checks pass for the automatic-cache bundle, security headers, and unauthenticated 401 responses on auth, local-index and local-revision endpoints. The public browser check reached the expected login page; authenticated feature checks were performed on the reviewed deployment, not repeated with a new public-origin login.
- Rollback target: `dpl_DVqiVg3We3VnmxG5foXorSm9cUhr` (previous public deployment).
- The release is the frozen previously live source plus the 18 allowlisted cache runtime changes. Unrelated dirty extension/editor files were excluded.
- No Git commit or push was performed. The Git baseline differs from the frozen live source in 22 runtime files, with one additional live file absent from Git. Automatic approval review rejected weakening that release guard; the guard remains intact. A separate clean-Git candidate also failed existing extension-related tests/server checking. Publishing used the independently validated frozen package rather than that failing Git candidate. Git/source reconciliation remains outstanding before a future branch-based release.

Release evidence in the ignored local evidence directory includes `release-audit.json`, `release-server-typecheck.json`, `release-hosted-checks.json`, `release-reviewed.png`, `release-live.json`, and `release-public-http.json`.

## Header-only cleanup, 2026-10-29

The follow-up changes only four Vue components over the exact published package. Server code, snapshot version, disk age and synchronization logic are unchanged, so this cleanup does not itself invalidate existing saved indexes. The isolated production build passes. A desktop browser fixture confirms one header dropdown, 15 category rows, automatic progress to 15/15, keyboard open/close, viewport-contained placement and no duplicate Compendium panel. The dropdown explicitly overrides the site's inline-disclosure animation to prevent clipping its floating content. Evidence uses the `header4-` prefix in the same local evidence directory.

Published as `dpl_2ikH6NWEv5xR72kvArSMb3CMHw8z` at https://dndoldal.vercel.app. All 389 deployed files match the reviewed manifest, the public alias is verified, and both staged/public bundle, security-header and unauthenticated API checks pass. Rollback target is `dpl_HWkJw9C7Ac5AnnjSizpNQQnQQWVb`. The Git reconciliation limitation above still applies; no branch commit/push was made for this follow-up. Earlier dropdown candidates were not promoted.

Redownload triggers verified in the source: first use in a browser/device/profile/origin; cleared, evicted, corrupt or missing site storage; explicit logout or switching account; a category copy older than seven days; library revision changes from imported packs, Workshop items or personal Compendium edits; or a future cache-format/index-semantics version change. The revision remains whole-library scoped, so a single library edit can replace every category index. An ordinary refresh, browser restart or same-account reauthentication after session expiry preserves valid saved copies and performs validation rather than an unconditional export. These copies contain browsing indexes, not every full entry description or asset.

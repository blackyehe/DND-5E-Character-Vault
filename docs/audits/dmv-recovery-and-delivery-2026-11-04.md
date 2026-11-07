# DMV browser recovery and opening-delay follow-up — 4 November 2026

## Scope

This follow-up addresses the two remaining findings from the [DMV preview performance release](dmv-preview-performance-2026-11-04.md): provider refusal of hosted character links, and intermittent page-opening waits. It introduces a user-controlled recovery path for the first and captures a more specific trace of the second. It does not claim that the external refusal or every navigation delay is eliminated.

## Character data recovery

The import panel now offers **Use copied character data**. A valid DMV character link exposes **Open or download character data**, pointing to the fixed HTTPS public data endpoint on `www.dungeonmastersvault.com`. If the browser downloads EDN, the existing file chooser accepts it. If it displays text, the user can paste it into the new labelled field and select **Preview copied data**. Existing exports can be pasted as well. The panel explains that PDFs and homebrew packs are unsuitable.

This uses ordinary, explicit browser navigation. It introduces no proxy, background fetch, clipboard permission, credential forwarding or CORS bypass. The server's upstream HTTP 403 remains reported accurately. Only approved hostnames and character-ID paths produce an external action; credentials, nonstandard ports, unrelated schemes, misleading domains, arbitrary paths and encoded IDs produce none. Tracking queries and fragments are discarded. The link uses `noopener noreferrer`.

Pasted text reaches the existing authenticated preview endpoint unchanged, including Unicode, whitespace and trailing newlines. The browser checks the four-MiB byte limit before sending it, rather than relying on character count. The text is retained after failure and cleared after success. It is not saved as a browser draft, and the user still reviews and explicitly imports the character separately. Source-only previews retain the existing file-import behavior of an empty source URL; opening a data link does not assert source provenance for independently pasted text.

The existing file chooser and original-choice export remain available. No server runtime file, database schema, hosting setting or environment flag is changed by this release.

## Opening-delay evidence

Four fresh Edge processes opened Compendium and Notebook through the public alias. Mutating requests were blocked. Route interception also disabled browser HTTP caching, while OS DNS/TLS and server/CDN caches were retained. This is a finite read-only investigation, not a load test or forced platform cold-start experiment.

One Compendium opening spent 2,492 ms on `/api/auth/me`; that response reported 148.7 ms in the timed application handler, including 128.8 ms waiting for database readiness. The HTML itself returned promptly with a CDN HIT. This occurrence therefore contains substantial delay outside the measured handler and cannot be explained by a slow Compendium query. The remaining observations did not reproduce the earlier multi-second static-delivery problem. The trace preserves request-level connection phases and Vercel request IDs for follow-up correlation, with query strings and record IDs removed from paths.

The application timer starts after module initialization and dispatch, so it does not measure the complete platform/request lifecycle. These data do not uniquely distinguish platform startup, routing/queueing or transport. A local import profile also measures substantial dependency-loading time, but includes Windows filesystem access and TypeScript-loader behavior; it is not a valid attribution of hosted startup cost. No speculative database, DNS, memory-tier or paid hosting change was made.

The next delivery investigation should correlate a slow request ID and timestamp with platform lifecycle data, or capture a recurrence on the affected network. Repeating warm reads alone would not establish the missing cause. The prior static cache improvement remains intact.

## Validation

The candidate is frozen from the published preview-performance release, with 489 exact source/test inputs. Only `src/components/CharacterLinkImport.vue`, new `src/lib/dmv-data-link.ts` and its new test file differ. All other published inputs are verified by hash, preserving the previously released server and Owlbear contracts.

All 288 tests pass, with the same two optional external-pack tests skipped; those cases passed separately during the preceding audit. Server and frontend types and the actual production Vite build pass. A wording review clarified the EDN download behavior; the final suite and build were rerun afterward.

The actual built browser fixture passes at 1280 and 390 pixels. It exercises the refused-link recovery, canonical external download, exact Unicode/whitespace bytes, failed-preview text retention, pending controls, a multibyte over-limit input rejected without a request, existing file upload, absence of browser persistence, removal of the external action for an unsafe address, and no horizontal overflow. There are no uncaught errors or save requests. All fixture data are synthetic; the local HTTP server is stopped after the run.

## Published result

Deployment `dpl_CE8hQuNTcyJVrgE1C7dutA62dJBZ` is live on both website aliases. Hosted and public acceptance pass, including the real copied-data preview, cleared successful input, unchanged original character library and no save requests. On the hosted candidate, the original URL-preview request still receives the expected upstream HTTP 403; the new user-opened data action successfully downloads the real public EDN in a normal browser navigation. Protection headers are attached only to requests to our own deployment and are explicitly checked as absent from the provider request. The downloaded original source remains private and ignored locally.

Eight grouped API responses match the prior immutable release. Fresh hosted/public browser checks pass for auth labels, protected redirects, desktop/mobile route recovery, dashboard and Compendium browse/detail. There are no uncaught browser errors or mutation requests in those read-only passes. The import acceptance separately permits only preview POST requests and confirms the character list is unchanged. This is targeted acceptance, not a newly repeated full-site audit.

All 489 hosted source inputs match the manifest. Both Owlbear aliases remain on `dpl_6yPZh1hytcg8a2XNzSHnRpZjpz8W`; server runtime files are identical to the preceding website release. Frankfurt and environment variable names are unchanged. Rollback is `dpl_7mSUPFstkSkNT1AuxEXR7pGB7tRk`, using `node .local/delivery-dmv-followup-20261104/release.mjs rollback` while the aliases still target this release. No Git commit, push or PR was made.

The slow auth request was also found in platform request logs by its exact request ID and timestamp: HTTP 200, Frankfurt, cache MISS, firewall action `allow`. Available request records expose no latency breakdown, and the request has no matching runtime log entries. Thus correlation succeeds, but these logs cannot establish startup as the cause. No plan/add-on was purchased to obtain additional metrics. [Vercel's latency investigation guidance](https://vercel.com/kb/guide/investigate-latency-issues-and-slowness) describes platform-side diagnosis; our captured evidence remains narrower than a complete platform lifecycle trace.

Private downloads, auth state and original campaign data remain ignored locally. Evidence is under `.local/delivery-dmv-followup-20261104/`, including `trace.json`, `provider-headers.json`, validation logs, `browser-fixture.json`, hosted/public acceptance, `platform-logs.json`, promotion and `final-gates.json`. The recovery path is verified; automatic hosted URL fetching and intermittent full-navigation delivery remain unresolved.

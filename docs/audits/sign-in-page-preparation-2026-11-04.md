# Requested-page preparation during sign-in — 4 November 2026

The requested feature page can prepare its public code and styles while the existing session check is running. Previously, the router awaited `/api/auth/me` before starting those page downloads. This change overlaps that work while retaining the existing sign-in, membership and private-data boundaries. It does not shorten the backend's startup itself or establish that every intermittent opening wait is resolved.

## Implementation and scope

The router starts its original sign-in request first, issues optional browser file hints, then awaits that same sign-in result. Only the first requested feature page is prepared. An explicit room destination can also prepare its Notebook, Maps or character section; the default room role/section is not guessed. Login and Dashboard are already part of the main entry, and public-demo/unknown routes retain normal behavior.

The browser uses native `modulepreload` for JavaScript and `preload` with `as=style` for CSS. These hints do not execute page modules, apply the hinted stylesheet, mount page components or request private data. Ordinary navigation still performs its normal imports, stylesheet application and access checks. A small build-owned JSON map is embedded in the current HTML, so there is no extra manifest API/fetch request or guessed hashed filename. The map contains only public asset paths; the client accepts only same-origin `/assets/` JavaScript/CSS paths and skips already-present script/link resources.

The final change comprises two browser runtime files (`src/router/index.ts` and new `src/router/page-preparation.ts`), the frontend build configuration (`vite.config.ts`), and one new test file. There are 491 frozen source/test inputs derived from published baseline `dpl_CE8hQuNTcyJVrgE1C7dutA62dJBZ`. Server runtime, Room view, authentication storage, API behavior, database schemas, content and hosting configuration remain unchanged. The separate room-first/Dashboard-splitting proposal is outside this release.

For this build, the inline file map is 6,021 raw bytes. The complete local HTML is 6,886 bytes, or 1,349 bytes with local gzip encoding; these are local serialization measurements, not asserted HTTP wire sizes. All nine map destinations resolve to existing built files, including the relevant stylesheet sets. Shared imports are deduplicated. An expired session can leave a bounded, unused public-page download; it does not authorize data access.

## Verification

The final frozen application passes all 297 tests, with the same two optional external-pack tests skipped. Those optional cases passed separately in the preceding audit. Server and frontend types and the actual Vite production build pass; source hashes remain unchanged. New tests cover destination selection, explicit sections, aliases, deduplication, invalid/non-asset paths, the one-initial-destination budget and graceful missing metadata/hint failures.

The actual production browser build passes 19 grouped checks. Ten sign-in-held cases cover Compendium, Creator, Workshop, room list, Notebook, Maps, room characters, default room, a character and the room joining destination. Requested files start while sign-in is withheld. No protected component or private API request starts before sign-in; denied sessions return to the correct login destination. Hinted styles are not applied early, and unrequested room sections stay unloaded.

The remaining cases cover persistent and transient CSS/JavaScript failures, both successful and denied sign-in, failures arriving after Login is already displayed, and cancelled navigation. Normal navigation retains its existing reload recovery when required files cannot load. A recovered page has its styles; abandoned page preparation does not fetch its private data or redirect back. Successful scenarios have no uncaught browser errors. Deliberate network-failure scenarios allow only the expected module/CSS failure diagnostics.

An initial unpublished import-execution prototype exposed a stylesheet-retry problem during built-browser review. The final native file-hint implementation avoids executing speculative imports and preserves normal stylesheet/error handling. That prototype was not staged or published. An incomplete Notebook mock response also caused a harness timeout; the entry response and listing-readiness selector were corrected before acceptance. Failed attempts and private local evidence are retained rather than counted as passing checks.

## Controlled positive-effect check

Eight serial fresh-context runs form four alternating control/candidate pairs using the real previous/final browser bundles. Sign-in replies are held for 650 ms and requested page-file replies for 300 ms; the same synthetic API data and delays are used in both variants. These controlled delays isolate overlapping work. They are not ordinary production latency estimates, forced backend cold starts or a percentile benchmark.

| Page and viewport | Previous order | Prepared during sign-in |
| --- | ---: | ---: |
| Compendium, desktop | 1,397 ms | 898 ms |
| Notebook listing, desktop | 1,918 ms | 1,422 ms |
| Compendium, mobile | 1,403 ms | 906 ms |
| Notebook listing, mobile | 1,917 ms | 1,414 ms |

Every pair returns the same core API request set, with one sign-in request, no protected requests before sign-in and no duplicate successful file downloads. The local synthetic HTTP servers stop after the check. Actual network/contention/platform behavior can alter the benefit; native hints can also be ignored by a browser.

## Hosted release gates

Deployment `dpl_Kos3t4SFmhPRmNNfVAFFPcXVyBTh` is live on both website aliases. Immutable address: `https://dndoldal-6l4jo0l9k-dndenjoyerstudio.vercel.app`. All 491 hosted source inputs match the frozen manifest. Frankfurt and environment variable names are unchanged. Both Owlbear aliases remain on `dpl_6yPZh1hytcg8a2XNzSHnRpZjpz8W`.

Hosted and public read-only API acceptance matches the prior release across characters, room identity, Creator, Notebook, sessions, links, Workshop and Maps. Fresh desktop/mobile browser checks pass for login labels, protected redirects, route recovery, Dashboard and Compendium browse/detail. The new hosted/public preparation checks verify actual early feature-file requests, one original sign-in request, no private reads before the verified response, and no duplicate successful file requests. Denied sessions preserve the requested destination at Login. Original character-library fingerprints remain unchanged. All browser contexts are closed; the user's existing room/browser session is untouched.

Four further alternating hosted pairs use real owner/API data with the same controlled 650 ms sign-in gate and 300 ms page-file delay. They are deliberately controlled hosted acceptance, not ordinary browsing measurements:

| Page and viewport | Previous order | Prepared during sign-in |
| --- | ---: | ---: |
| Compendium, desktop | 1,657 ms | 1,400 ms |
| Notebook listing, desktop | 2,542 ms | 1,477 ms |
| Compendium, mobile | 1,680 ms | 1,498 ms |
| Notebook listing, mobile | 2,522 ms | 1,492 ms |

All four pairs improve readiness and retain the same core API request set. Final public structural checks also hold sign-in for 650 ms to observe overlap, but apply no artificial file delay; their durations are likewise not ordinary-latency claims. These results support the specific overlap improvement, without a guaranteed saving for every network or a resolution of backend startup/routing waits.

Rollback is the compatible preceding release `dpl_CE8hQuNTcyJVrgE1C7dutA62dJBZ`, using `node .local/sign-in-page-preload-20261104/release.mjs rollback` while this candidate still owns the public alias. No database work or campaign restoration is required. No Git commit, push or PR was made; publication used the verified frozen package and deployment promotion.

Evidence is ignored under `.local/sign-in-page-preload-20261104/`: scope/manifests, validation/build-map records, browser checks, retained prototype/failure evidence, staged release, hosted/public checks, promotion and `final-gates.json`. Original campaign content and credentials are not included in this report.

# Map opening recovery — 1 November 2026

The user asked to continue the loading/map plan after publishing the Compendium fixes. The narrow map recovery change is now **live and publicly verified**, following a fresh exact-source review with safer initialization diagnostics. The first candidate was withheld after an independent Owlbear availability failure. The unfinished remembered-login feature remains separate.

## User behavior

Map details and the authorized image still load concurrently. Healthy opening adds no retry delay or extra requests. If a read encounters a network interruption, interrupted response body or HTTP 408/502/503/504, only that part receives one retry after 250 ms. Successful parts are reused within the opening. There can be at most four GETs for one opening, versus two on the healthy path.

One overall deadline per part covers both attempts and response body reading: 15 seconds for details, 20 seconds for the image, matching the previous limits. Expired deadlines do not start another attempt. The final message identifies whether details or the image failed, and distinguishes a connection failure from a timeout or invalid response. A direct **Retry map** action opens the failed map again.

HTTP 401/403/404 is never automatically retried, retains its status and clears the inaccessible selection using the existing UI behavior. Other statuses, including 429, are not automatically retried. Writes use their existing paths without new retries. Current room and player-preview query scope, credentials, image cache revalidation, revision checks and sharing rules are preserved. Switching maps/unmounting cancels in-flight work and prevents late results from opening the wrong map. The full opening counts as foreground work so automatic Compendium preparation yields while the image is loading too.

This is connection recovery, not evidence that Revalon's earlier incident had one specific cause. The real continent map and campaign were not changed. Successful responses still rely on the existing server payload contracts and browser image decoding; the existing image-decoding retry UI remains intact.

## Validation

- Twenty focused tests cover both failed stages, temporary HTTP statuses, permanent and permission errors, body interruptions, malformed JSON, cancellation during backoff, sibling cancellation and deadlines spanning retries.
- All 701 website tests pass, with 48 existing skips. Frontend type checking and the production build pass.
- Ten desktop Edge scenarios mount the actual Vue component with intercepted synthetic responses: healthy decoded image, automatic recovery for either failed part, persistent failures and manual retry, each of 401/403/404, switching maps and unmounting. No page exceptions or writes occur.
- The hosted package's 413 source files match the frozen manifest. The runtime scope is `src/components/maps/RoomMaps.vue` and new `src/lib/map-loading.ts`; server and authentication files are unchanged.
- Seven hosted map scenarios pass using temporary maps and a character in the reusable isolated test room. They cover owner access, player sharing, authorized 304 image revalidation, DM player preview, actual desktop automatic recovery from an injected image 503, persistent failure/manual retry, player opening without owner controls and revocation denying even cached-image revalidation.
- Eleven existing hosted character/editor/player workflow checks pass. Ten read-only standard-rule and desktop Compendium checks pass after fixture cleanup. The test helpers run these sequentially to preserve their empty-account assertions.
- Synthetic maps, character, assignment and temporary membership are removed. Map storage quotas return to their initial values, and active synthetic libraries are empty. Cleanup uses the supported revision-checked map deletion route.

No ordinary load-time speedup is claimed. This removes a manual recovery step for selected temporary failures and supplies a clear recovery action for persistent failures. The extra retry can make a persistent eligible failure take 250 ms plus the second request longer, within the original deadline. It does not remove server/network delays.

## Initial review: withheld

Reviewed candidate: `dpl_GftJe1p6zAt6KCmejojZw5DgiQvv`, immutable `https://dndoldal-p0bds6gdf-dndenjoyerstudio.vercel.app`.

Current live baseline: `dpl_FzBdyV5yuKkPYKwyXRJyxAyQ7s59`, immutable `https://dndoldal-itpupb2bj-dndenjoyerstudio.vercel.app`.

The reviewed candidate repeatedly returns HTTP 503 from the Owlbear reference boundary with both absent and permitted origins. The unchanged live baseline returns the expected 403 for absent origin and 401 for permitted origin without a session. Sanitized runtime diagnostics identify `owlbear-initialization-failed`, stage `pairing-indexes`, kind `unclassified`. This narrows the failing stage but does not establish its root cause. The same broad availability symptom was observed during an earlier rollout; the new evidence must not be described as a proven map regression or a repaired authentication issue.

Promotion was not attempted. The next separate availability investigation should reproduce pairing-model initialization and inspect safe error classification, connection readiness and retry behavior without changing grant scope or mixing in the unfinished remembered-login feature. Do not bypass or weaken the gate to ship this map change.

## Published fresh review

The user subsequently authorized publishing all safe work and continuing the next task. A fresh candidate includes the exact map change plus fixed, privacy-preserving initialization error categories. It passes 702 tests, backend types, the hosted build and all hosted character, player, map and rules gates. Its Owlbear endpoints return the expected 403/401 before promotion. It was promoted as `dpl_3TBrHnbQdE4jQgLX6DQFbZYYxNew`, immutable `https://dndoldal-2zly1y4ns-dndenjoyerstudio.vercel.app`. Immediate public HTTP/security, standard-rule/desktop and seven actual map owner/player/recovery/revocation scenarios pass, with fixture cleanup and quota restoration verified. The previous Compendium deployment above is the rollback target.

Evidence for this publication is `.local/owlbear-initialization-20261101/live.json` and its associated exact-source, review/public checks. The healthy fresh review does not prove that the intermittent initialization problem is fixed. A real-Mongoose isolated replay demonstrates a cached transient failure that persists after storage recovery; a separate startup-readiness change is being evaluated. See [the startup investigation](owlbear-startup-recovery-2026-11-01.md).

Ignored evidence: `.local/map-recovery-20261101/`, containing exact source/scope, local results, desktop scenarios/screenshots, hosted map/workflow/rules checks, source audit, cleanup evidence and the sanitized extension diagnostic. Git may retain its current README as the previously documented documentation-only difference from the frozen website artifact.

# Hosted creator validation and local browsing — 28 October 2026

## Finding and calculations before release

The ordinary creator cache transport does not reach the application in the measured hosted setup. An explicit browser GET with a valid-shaped, deliberately stale `If-None-Match` produced a 200 response whose application diagnostic recorded `normalpresent:false`, `conditionalSelected:false`, and `fullSnapshot:true`. A corresponding request with `X-Creation-Revision` recorded the header as present and valid, selected conditional validation, and correctly rejected the stale revision. This establishes the application boundary behavior; it does not establish which intermediary consumes the standard header.

A 304 response alone therefore did not establish that the application avoided rebuilding the catalogue. Some slow 304 responses carried the existing `Server-Timing` header, which the exact release source adds only through `res.json`. On a cold instance, the application can construct the catalogue before the hosting stack returns an unchanged response.

The first isolated hosted measurements used the real 126-pack library:

| Read | Observed elapsed time | Result |
| --- | ---: | --- |
| First creator response | 11,888 ms | 2,696,833 bytes; full catalogue |
| Standard conditional request, application RAM bypass requested | 10,854 ms | 304, zero body |
| Application revision request, same RAM bypass requested | 412 ms | 304, zero body |
| Deliberately stale standard revision, warm RAM | 518 ms | Header absent at application; full catalogue response |
| Deliberately stale application revision, warm RAM | 920 ms | Header received; stale revision rejected, current catalogue returned |
| Unsaved monster category, selection to rendered rows | 12,053 ms | Ordinary server browsing |

The conditional pair saves `10,854 - 412 = 10,442 ms`, or **96.2%** of the measured request time. These are diagnostic observations, not a controlled median or a guarantee of full character-creator readiness. Initial loads and changed libraries still require the real catalogue. The first creator read spent 8,840 ms in the component cursor, 1,020 ms reading component manifests, and 500 ms reading initial metadata. One component `getMore` alone took 6,425 ms.

## Retained local correction

The browser sends its existing saved tag through `X-Creation-Revision`. The route passes that value to the existing exact, account-scoped metadata validator, with `If-None-Match` retained for older clients. Response identity, SHA-256 payload validation, expiry, authentication, account transitions and full-fetch retry behavior remain unchanged. No cache lifetime extension or offline authorization is introduced.

HTTP regression checks exercise custom-header-only requests, older clients, conflicting transport tags, stale/malformed revisions and authentication refusal. Client checks verify the custom header and preserve the existing integrity/ownership/failure tests. The first local focused run passes 25 tests across three files.

## Compendium safeguards and diagnostic scope

The local category prototype originally allowed separate worker, disk and revision timeouts to delay server fallback. A retained local correction caps the whole optional attempt at 1,500 ms, aborts a stalled revision request, terminates a stalled worker, and skips local attempts for 30 seconds after a timeout. Cancelling a search releases its waiting caller promptly. Silent-worker and stalled-network regression tests pass. On a responsive browser the exceptional path can still add up to 1.5 seconds before ordinary browsing; this is a drawback to measure, not a claim of zero cost.

The first diagnostic deployment is `dpl_GfTMcWzAYxF1VAjSVZYzzthDJe95`. Its 383-source-file audit exactly matches the frozen manifest, with automatic public aliases disabled. Its runtime Vite feature flag did not enable the Compendium controls: Vite needs the flag during the frontend build. Consequently, no saved-category UI measurement is claimed from this deployment. The corrected diagnostic enables the feature in its isolated frozen source only. The working checkout remains disabled by default.

The corrected frozen diagnostic passes both TypeScript checks, the production build, 55 focused tests across eight files and an exact 383-source-file hosted audit. It is `dpl_6ukz9Y4zpu3wq33pmtGTyExNgg7w`, with public aliases disabled. Neither diagnostic is a production release. No database engine, cluster, billing or project-wide environment setting changes.

## Corrected hosted results

On the corrected diagnostic, actual monster category selection took **12,121 ms** on the first ordinary server read. After explicit saving and full document revisits, the corresponding UI times were **379, 646 and 377 ms** (median **379 ms**). Each saved selection made one authenticated revision request, read only metadata, and made no ordinary category request or component-definition read. The observed cold-to-saved difference is `12,121 - 379 = 11,742 ms` (**96.9%**). This avoids the cold reconstruction; the earlier warm-server measurements remain relevant and do not promise a comparable gain on every visit.

Explicit saving took **5,356 ms** with the server category already warm. Browser resource timing confirms **901,673 compressed bytes** and a **6,118,490-byte decoded JSON envelope** (the index payload itself is 5,493,120 bytes). A saved search took **258 ms**, including the existing 250 ms debounce, with no additional API request inside the validated window. The hosted worker and server returned exactly matching complete page JSON for five further monster queries, including pagination, an empty match and a category filter.

The actual creator's first document reached visible ancestry choices at **17,482 ms**, including a **16,016 ms** first catalogue transfer. Three subsequent document visits reached choices at **2,188, 1,063 and 1,207 ms** (median **1,207 ms**); all three catalogue requests returned 304 with zero body bytes and no UI alerts. The observed first-to-repeat UI difference is **16,275 ms** (**93.1%**). This includes normal first-visit asset/server-cache differences; it must not be attributed entirely to the transport change.

A separate diagnostic request with application RAM explicitly bypassed, a valid application revision and a tiny diagnostic JSON acknowledgement took **700 ms** end to end, **326 ms** in the application. Its profile confirmed `conditionalMatch:true`, **325 ms** of metadata validation, one metadata find and one getMore covering the 126 packs, and **no full snapshot or component collection reads**. The acknowledgement changes only the diagnostic response format so the hosting layer retains the profile header; ordinary UI requests retain the real 304 protocol.

Production-UI failure tests against a fictional local account and a deliberately delayed fixture server verified both a stalled revision and a silent worker. Full document readiness was 1,881 and 2,421 ms respectively; subsequent searches during backoff took 617 and 618 ms including debounce and a 300 ms fixture response. These establish fallback behavior, not hosted speed guarantees. The complete working-checkout suite passes **513 tests with 55 opt-in skips**, including the existing unrelated unfinished extension work.

## Release boundary

The user has authorized safe shipping after receiving calculations. The creator transport correction was packaged independently: only `server/routes/content.ts` and `src/lib/creation-options-cache.ts` overlay the exact 376-file live manifest. No profiling hooks or Compendium prototype files enter that release. The local Compendium candidate remains uncommitted and disabled by default, with explicit first synchronization, evictable device storage, a 30-second revision window and a bounded fallback delay still requiring consideration.

Deployment `dpl_3UMbRS3yLw3P8Dbbigd7Zo4aZkBL` (`dndoldal-qhvwl5a4d-dndenjoyerstudio.vercel.app`) passes its build, both TypeScript checks, 34 focused tests and the exact 376-file hosted source audit. Anonymous login/assets and extension origin/auth refusals match the prior public release. Authenticated logic review used the corrected diagnostic with the exact release client and route transport expression; that diagnostic's additional profiling/Compendium code is excluded from the release. No authenticated check of the final immutable release domain is claimed.

One authorized promotion request moved `https://dndoldal.vercel.app` to this deployment. The immediate alias read was still old; a subsequent independent read confirmed propagation, and no duplicate promotion was attempted. The previous deployment `dpl_6bpCG5upDkhHqAFApKoZhGH1vdC1` remains the rollback target.

Authenticated post-promotion checks used the existing public-site session and existing saved catalogue. The first new-asset visit reached creator choices at **3,544 ms**, with a **724 ms** body-free 304 catalogue check. Subsequent full document visits reached choices at **1,146 and 955 ms**, with **422 and 430 ms** body-free 304 checks. All had 12 visible choices and no UI alerts. The persisted catalogue still matches the authenticated owner, its computed SHA-256 checksum and the reviewed payload. Public login/assets and extension boundaries were rechecked after promotion. Frozen release/evidence is in `.local/creator-transport-release-20261028/`.

Ignored evidence is retained under `.local/conditional-profile-20261028/` and `.local/conditional-profile-20261028-r2/`. The first directory contains numeric-only creator measurements and the server category timing; the second contains the corrected frozen source and validation logs. Earlier local category measurements remain in [the local Compendium audit](local-compendium-2026-10-28.md).

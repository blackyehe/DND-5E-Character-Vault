# Character loading: conservative reference caching and measurements

## Scope and requirements

The user requested faster loading through caching, conditional on preserving the site's existing operation, and asked to keep comparable loading measurements. The editor alignment correction takes priority over the Compendium scrolling adjustment. Those visual fixes are kept in a separate commit from caching so either can be reverted independently.

## Cache behaviour

- Character opening always makes a fresh authorized quick-sheet request. Server permission checks, assignment checks, saves and room polling retain their existing paths.
- Only an exact-version reference response can be reused: the signed-in account, owner/room/champion path, role, character `updatedAt` and Workshop library revision must match.
- Temporary player previews bypass this shared reference cache.
- Cache entries expire after two minutes. The cache holds at most 24 responses, subject to a 4 MiB serialized-payload estimate. Original import documents are excluded. Responses are cloned to prevent one sheet from mutating another copy.
- Cache memory is cleared on login, registration, logout, account identity changes or explicit reference retry. An epoch prevents in-flight requests from repopulating a cleared cache.
- This is browser-session memory, not localStorage, IndexedDB, a service worker or a public CDN cache. Closing/reloading the website starts fresh. Private API responses keep their existing `private, no-store` policy.
- Ordinary HP, temporary HP, inspiration, death saves, hit-dice usage, point usage and spent-slot changes no longer trigger reference hydration by themselves. Rule-relevant changes, including features, spell selections, equipment, class/race/level, abilities, choices and library revisions, still do.
- Cached resolved characters use the existing saved-version, mutation-counter, view-scope, editor-draft and preview guards. The current authorized sheet retains its original import metadata.

This pass primarily improves unchanged repeat visits and reduces unnecessary reference requests during play. It does not eliminate the initial server/database request or guarantee a particular cold-start time. A saved-version change conservatively causes a cache miss on reopening.

## Measurements visible in the site

Open **Loading status** beneath the sheet:

- **Sheet:** elapsed quick-sheet opening time, measured before reference hydration.
- **References:** elapsed time from the saved sheet arriving to the reference pass completing, including any hydration restart.
- **Reference source:** Server or Reused. A pass that initially contacts the server stays labelled Server even if a subsequent internal hydration pass reuses the response.
- Recent openings: up to eight for the current character, from the last 30 openings in the current browser session. Account changes clear this history.

Background room polling does not overwrite the original opening measurement. Sheet and reference durations are separate phases, not two interchangeable measures of full-page startup. The history is local; it is not sent to an analytics service.

## Baseline: before this change

Measured through the signed-in production UI on 20 October 2026, using Volenta in the ordinary owner view. No character or resource writes were performed. Pre-change deployment: `dpl_pduE5JK61Wh5Fpb92NAwMLJ48kzg`.

| Opening | Sheet | References | Context |
| --- | ---: | ---: | --- |
| 1 | 0.46 s | 1.10 s | Page reload |
| 2 | 0.55 s | 0.49 s | Dashboard → Volenta |
| 3 | 0.63 s | 0.69 s | Dashboard → Volenta |
| Median | 0.55 s | 0.69 s | Small warm-session sample |

The pre-change display was additionally observed at 0.54 s / 0.48 s before the measured sequence, but that earlier page's load context was unknown and is excluded from the table. Historical cold-reference observations around 15 seconds are documented in `SHEET_LOADING_AND_REPAIR.md`; these three new samples do not reproduce or disprove those slower cases.

Record post-release samples separately with their reference source. Compare the same character and view, and distinguish first requests, unchanged repeat visits, changed saved versions and cache expiration. Small samples are observations, not latency guarantees.

## Checks

Frontend type checking and production build pass. Eighteen targeted checks cover cache boundaries, expiry, copy isolation, payload limits, ignored play counters, relevant rule changes, mounted-library reuse after a fresh quick read, forced refresh, changed saved/library versions, hydration timing, existing player preview behaviour, late responses and preserved editor state. Post-release UI observations and rollback identifiers belong in the release record.

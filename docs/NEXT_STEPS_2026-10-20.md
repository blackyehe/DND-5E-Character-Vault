# Follow-up priorities — 20 October 2026

## Character editor

The user clarified that the top navigation and bottom save/discard panel should match the middle panel's width. The correction uses the existing 880px width, and editor navigation styles now load with the editor rather than depending on the Game Room stylesheet. This is a small alignment correction; a broader editor redesign was not requested.

## Loading and caching

Continue investigating the loading improvements discussed in chat. Current findings:

- Standard SRD requests already have an in-memory cache for the open website.
- The sheet-local reference cache is discarded on unmount.
- Opening a character clears the current sheet and requests a fresh quick snapshot.
- Reference hydration watches `updatedAt`, so ordinary resource saves can trigger another reference request.
- The quick snapshot includes a Workshop library revision marker, which can help distinguish rule changes from play-state changes.

The first caching pass retains exact-version reference responses in bounded session memory and avoids reference reloads for ordinary play counters. Fresh authorized character reads and all server save paths are retained. Loading history tracks the sheet and references separately. See `SHEET_CACHE_AND_TIMINGS_2026-10-20.md`. Persistent character snapshots remain a possible later step requiring a separate decision.

## Compendium — after the editor

The right-hand detail panel now has the same 70vh height limit and independent scrolling as the result list. It supports keyboard focus and resets to the top when selecting another entry.

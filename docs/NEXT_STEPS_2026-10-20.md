# Follow-up priorities — 20 October 2026

## Dashboard and DM room character workspaces

**Status:** Implemented on 21 October 2026; release details are recorded in `DASHBOARD_ROOM_WORKSPACE_RELEASE_2026-10-21.md`.  
**Authorization:** The user confirmed “Yes—implement and publish”, then requested the same layout principles and animations for the DM view inside rooms.

### Selected direction

- Keep the character roster on the left of the dashboard.
- Open the selected character's complete sheet on the same page, with its existing tabs and controls.
- Keep character import and creation tools accessible from that dashboard.
- Allow the roster to collapse to give the sheet more room.
- Use Flowing motion for sheet tabs, descriptions, buttons and resource updates.
- Use Expressive motion for character switching, roster collapse/expansion and import panels.
- Respect reduced-motion preferences and keep interactions independent of animation completion.

### Starting references

The layout and motion demonstrations use illustrative data and are not the production implementation:

- Layouts: `C:/Users/PC/.codex/visualizations/2026/10/17/01a14b8c-9c21-7ff0-81a5-3ba2f85c5819/dashboard-character-workspace.html`.
- Motion: `C:/Users/PC/.codex/visualizations/2026/10/17/01a14b8c-9c21-7ff0-81a5-3ba2f85c5819/dashboard-workspace-motion.html`.

The implementation embeds the existing sheet and import flows, confirms before discarding unsaved edits, and waits for ongoing saves before switching. The DM room shares the searchable, collapsible roster and adds an assignment control beside the selected sheet. Player preview remains available. Git checkpoint: `pre-dashboard-workspace-2026-10-21`.

The sections below are earlier follow-up context.

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

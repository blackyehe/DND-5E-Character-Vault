# Potential changes

This document contains only ideas the user explicitly asks to record here. Discussing an idea does not automatically add it to this list. An entry is a topic for later review, not approval to implement or publish it.

Keep each entry's identifier stable so individual ideas or the whole list can be discussed later. Record decisions and status changes when the user makes them.

## PC-001 — Selective background loading

**Added:** 20 October 2026  
**Status:** Idea retained for future discussion; implementation not requested.

### User's idea

Begin loading likely-needed content in the background after someone opens the website, so part or all of the loading has already finished when they need it. Explore selective background loading for character sheets as a way to reduce the visible wait for reference content, including the occasional reference load of roughly 15 seconds.

### Approach discussed — still to be decided

- For players, prepare references for their assigned character.
- For the DM, prioritise the last-opened character and characters in the game room being used.
- Use a small background queue and give an actively opened character priority.
- When a character's references are already loading, let the opened sheet join that request.

These are discussion points, not agreed implementation requirements.

### Requirements raised by the user

- Proceed with performance changes only when they preserve the site's current operation.
- Keep loading measurements so improvements and regressions can be compared.

### Questions for the eventual review

- Which event should begin loading: arriving at the dashboard, entering a room, or selecting a character?
- Which characters should be prepared, and in what order?
- How should background work be limited to avoid slowing active use or wasting bandwidth and server resources?
- How should this interact with the current two-minute cache lifetime and saved-version checks?
- How much waiting was actually avoided when users opened their sheets?

### Existing context

The current reference cache and its measurements are documented separately:

- [Cache behaviour and baseline timings](SHEET_CACHE_AND_TIMINGS_2026-10-20.md)
- [Published release, observed results and rollback](SHEET_CACHE_RELEASE_2026-10-20.md)

## PC-002 — Adapt an existing creature

**Added:** 20 October 2026  
**Status:** Retained for after the monster creator is finished; not part of the initial creator.

The user liked the “Template and adapt” preview and explicitly requested retaining it as a separate feature from the creation tab. The proposed flow starts from an existing creature, lets the DM adapt its statistics and rules, then reviews the resulting creature before saving. The original creature remains available.

Build and finish the monster creator first. Return to this separate adaptation workflow afterwards. Its entry point and detailed behaviour still need review before implementation.

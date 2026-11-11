# Inline existing-character updates A — 11 November 2026

The user selected A after finding saved-definition updates too convoluted.
Update existing characters now sits beside Save in the item editor, Compendium
editor and option/spell Workshop save panels. The saved item editor stays open
and retains the returned source/definition revisions for later edits; giving and
character-draft modes keep their existing completion behaviour. Item library
cards also expose Update characters without requiring another edit. Sheet saved
rule updates open the same comparison immediately, without a second discovery
button. Unsaved drafts disable updating and invalidate old comparisons.

The shared component loads the affected characters in that action, names added,
removed or changed trackers, displays real changed statistics and labels unchanged
totals, and keeps full differences under See all changes. Material warnings remain
visible. Repeated preservation/source boilerplate is stated once. The comparison
is focused/scrolled into view after loading, including inside the item dialog.
One explicit Update Volenta / Update N characters action confirms the displayed
source and selected characters. Multiple outdated rows are selectable; blocked
and already-current rows cannot be submitted.

The existing backend remains byte-for-byte unchanged. Every write carries the
reviewed definition revision, exact character timestamp and server review hash,
plus confirmedSource:true from that deliberate final action. Owner checks, source
transactions, blocked selections and atomic per-character version checks remain.
Multiple updates use sequential existing endpoints. Completed rows are reported
individually; a failure stops the remaining requests and requires a fresh read
before retrying, including ambiguous network failures. There is no blanket live
propagation or automatic replay. Source/draft/account changes and unmounts discard
stale responses and stop subsequent batch requests; an old read cannot unlock a
newer read. Current HP, spent uses, inventory state, notes and unrelated choices
keep the backend's established preservation rules.

This package reconstructs width-only deployment
`dpl_DeG256XUPhRvkWF5yUFi2eeV1Bdp` (568 inputs), overlaying eight frontend runtime
files and four tests. Two new summary helper/test files bring the total to 570.
Unpublished older checkout backend changes are excluded. Owlbear remains an
independent unchanged release; no account permissions or production records are
changed by development or deployment. Volenta's actual pending item update remains
the user's explicit action through the UI.

Evidence, exact preimages/overlay, source manifests and guarded release helper
remain in `.local/character-updates-20261111/`; review on 11 December 2026.
Frozen source, fixture databases, Vite/browser profiles and caches use managed
temporary workspaces, existing dependencies and finally cleanup. Tests retain two
workers with filesystem module cache disabled. Browser fixture requests are fully
intercepted on a local-only origin and use synthetic records. The desktop/phone
flows verify two trackers, exact save/review payloads, one discovery request, one
confirmation, retained item-editor state, a subsequent save with fresh revisions,
unsaved guards, visible comparison and no horizontal preview overflow. These are
isolated tests, not a live campaign or Owlbear-room update.

Final checks pass: 42 focused component/helper tests, all 16 isolated MongoDB/HTTP
scenarios, frontend/server type checks, production build and both 390/1100px
end-to-end UI cases. Frozen-package checks include the actual final summary scroll
position and equipped availability. Fixture routing/locator corrections preceded
the final successful run; a visual check caught the below-fold loading position,
which was corrected before staging. Temporary workspaces and filesystem cache are
empty after completion. An expired hosting read credential was refreshed once
through the installed CLI's normal whoami flow; no settings or permissions changed.

Live on both website aliases and the production pointer as
`dpl_FFk7saKgXK5KCiNcJYym4TDhESDq`:
https://dndoldal-xkumvzlhx-dndenjoyerstudio.vercel.app.
All 570 hosted source hashes match the frozen candidate. Region, environment
variable names and existing secondary website protection are preserved.
Public/authorized JSON health checks pass; anonymous character access returns
JSON 401. Both Owlbear aliases remain at `dpl_pbH4Z99bAWx34cKfyvSFwtepBeUg`.
No live campaign records were written.

Guarded traffic-only rollback while this release remains current:
`node .local/character-updates-20261111/release.mjs restore`.
It accepts only candidate/baseline website aliases, checks unchanged Owlbear
aliases, preserves unrelated newer deployments and leaves metadata untouched.
Website rollback baseline: `dpl_DeG256XUPhRvkWF5yUFi2eeV1Bdp`.

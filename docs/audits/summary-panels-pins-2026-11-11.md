# Summary panels A and centred Pins — 11 November 2026

The user selected A after comparing two quick grouping previews. Skills &
proficiencies and Saving throws share one sheet panel. Combat at a glance has its
own panel. Training & languages remains the reference panel treatment. Removing
the summary-only transparent/borderless/padding reset restores the existing
theme and density styles rather than introducing another panel palette. The
saving-throw subgroup uses a subordinate heading. All values, proficiency shades,
rest/XP controls, attack calculation and save behaviour remain unchanged.

Shared disclosure controls centre inside the existing 110px action gutter (72px
on narrow screens). The action container's minimum height follows its own
summary header, rather than the expanded details body. A small ResizeObserver
on actionable headers responds to title wrapping, fonts and resizing, with a
one-time measurement fallback and disconnect on unmount. Read-only disclosures
do not create observers. Native disclosure markup, Pin/Unpin and move controls,
fixed card widths, source order and independent column stacks are retained.

The package reconstructs `dpl_Hr7CznKcHvTNh3xU1p9oWdD3RhCN` (571 exact inputs),
overlaying only CharacterSummary.vue, SheetDisclosure.vue and sheet-alignment.css.
No backend, canonical C colour stylesheet, permissions or Owlbear client changes.
Both Owlbear aliases remain on `dpl_pbH4Z99bAWx34cKfyvSFwtepBeUg`. The checkout's
unpublished extension differences are excluded. No live campaign records are
written during development or deployment.

Validation reconstructs that exact hosted source in a managed temporary
workspace, reuses installed dependencies and disables filesystem module caching.
The focused existing component tests cover summary/rest/statistics and adjacent
spellbook/equipment/party controls. The existing 19 local MongoDB/HTTP scenarios,
both type checks and production build remain in the release gate. All 18 focused
tests and 19 database scenarios pass.

The browser fixture mounts the actual Summary, chunked feature list and shared disclosure components
with real application CSS and local fonts. It covers 390/1280px, classic/Folio,
compact/comfortable density, dark/light themes and normal/large text. Checks
require shared skills/save ancestry, separate combat ancestry, identical panel
styles to Training, retained proficiency shading, no overflow and centred buttons
for short and wrapped headings before and after expansion. Opening either column
preserves the other column's document position. Clicking a slotted Pin control
does not toggle its disclosure. Every API request is blocked and writes stay zero.
Position checks use document coordinates so automatic browser scrolling is not
mistaken for a layout shift. All 32 cases pass, including 16 with two real feature
columns. Typography follows the selected classic/Folio face. Browser contexts,
servers, profiles and caches close
in finally before managed cleanup.

Retained exact preimages/overlay, manifests, concise test evidence and selected
synthetic screenshots are in `.local/summary-panels-pins-20261111/`; review on
11 December 2026. The selected comparison and notes are in `docs/design/`.
Recovery inputs remain retained rather than disposable scratch.

Live on both website aliases and the production pointer as
`dpl_FxzH92rYQnWttdGtKzvVcJqDCeTe`:
https://dndoldal-mjk296wol-dndenjoyerstudio.vercel.app.
All 571 hosted source hashes match the frozen candidate. Region, environment
variable names and the secondary website's existing protection are preserved.
Public/authorised JSON health checks pass; anonymous character access remains
JSON 401. Both Owlbear aliases are unchanged, no campaign records were written,
and workspace check reports zero managed scratch runs and zero filesystem cache.

Guarded traffic-only rollback while this release remains current:
`node .local/summary-panels-pins-20261111/release.mjs restore`.
It refuses unrelated newer traffic and checks both unchanged Owlbear aliases.
Rollback baseline: `dpl_Hr7CznKcHvTNh3xU1p9oWdD3RhCN`.

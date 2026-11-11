# Tracker outline B, inline casting and spell action alignment — 11 November 2026

The user selected B with theme-derived border colour. Tracker cards use a 1px
border mixing the current accent (40%) with the theme line colour. Their fill
mixes the accent (3%) with the existing panel colour. Spent pips use a transparent
fill while retaining their existing outline, opacity, state and labels. This
separates the count markers from the previous saturated card background without
changing their operation. No canonical C tokens or independent Owlbear CSS change.

Spell attack, Save DC and Casting now share a compact plain definition list,
left-aligned with thin separators and natural wrapping in narrow space. Both
the normal grid and resource rail use it. The former highlighted statistic
classes and separate rail casting paragraph are no longer applied. All existing
calculations, regular slot cards, grouped rail slots, recovery labels, notes,
spend/recover/use/restore and rest handlers remain.

The existing 94px spell action gutter now centres its contents horizontally.
At will, Known and Prepare/Prepared stay beside the same cards. At the existing
mobile wrap breakpoint, the action row spans the card width and centres its
contents below it. Native disclosure behaviour, card widths, ordering and
independent columns are preserved. Pin header alignment from the preceding
release is untouched.

The package reconstructs `dpl_FxzH92rYQnWttdGtKzvVcJqDCeTe` (571 exact inputs),
overlaying only CombatTrackers.vue and sheet-alignment.css. The checkout's older
unpublished extension differences and every backend input are excluded. Both
Owlbear aliases remain at `dpl_pbH4Z99bAWx34cKfyvSFwtepBeUg`. No campaign
records are written by development or deployment.

Frozen validation passes: 20 focused component tests, all 19 real local
MongoDB/HTTP scenarios, frontend/server types and production build. The 32 browser
cases mount the actual trackers and spellbook with their real reference provider,
CSS and fonts. They cover desktop/mobile, regular/rail, classic/Folio, dark/light
themes with crimson/forest accents, and normal/large text. Each case also changes
a custom accent and checks that the border responds. Checks require the exact
theme-derived border/fill, 1px outlines, plain left-aligned statistics, distinct
pip backgrounds, centred spell actions, equal disclosure widths and no overflow.
Sixteen cases use two actual independent spell columns; expanding either side
preserves the other side's document position. Isolated mock saves exercise slot
Use/Restore and resource Spend/Recover. No real campaign write occurs.

Temporary frozen source, browser profiles, Vite caches and database files use
managed workspaces, existing dependencies and finally cleanup. Filesystem module
caching remains disabled. Every browser API request is intercepted on a local
origin; external requests are blocked. Exact preimages/overlay, manifests,
concise evidence, four selected synthetic screenshots and guarded release
receipts are retained in `.local/tracker-outline-stat-line-20261111/`; review
on 11 December 2026. Selected preview/notes are retained in `docs/design/`.

Live on both website aliases and the production pointer as
`dpl_DtLtE3qQm9NSwSMWDGgCtK2jmPJb`:
https://dndoldal-ghuz8i0fs-dndenjoyerstudio.vercel.app.
All 571 hosted source hashes match the frozen candidate. Region, environment
variable names and secondary website protection are preserved. Public/authorised
JSON health checks pass; anonymous character access remains JSON 401. Both
Owlbear aliases are unchanged. Workspace check reports zero managed scratch runs
and zero filesystem cache. No live campaign records were written.

Guarded traffic-only rollback while this release remains current:
`node .local/tracker-outline-stat-line-20261111/release.mjs restore`.
It refuses unrelated newer traffic and requires both Owlbear aliases to remain
unchanged. Rollback baseline: `dpl_FxzH92rYQnWttdGtKzvVcJqDCeTe`.

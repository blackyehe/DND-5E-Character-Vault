# Width-only sheet alignment — 11 November 2026

The user rejected the card-grid previews because expanding one row moved the
opposite column and controls had moved into footers. The request is uniform
widths with the existing functionality. This release changes only
`src/components/sheet/sheet-alignment.css`; no component markup, events, grouping,
independent column composable, disclosure state or character data changes.

Spell rows reserve the same 94px action area; no-action granted rows reserve its
equivalent space. In two-column layouts the existing granted-spell stack uses
the width of a class-spell group. It stays above the other groups in its original
order. Shared feature disclosure actions use a consistent 110px gutter (72px on
small screens). Inventory controls have consistent slots inside a 420px area for
equipment/attunement, quantity and removal, so missing controls do not widen title
panels. Existing narrow viewport/container wrapping is preserved. Native details
remain independent, with no new grid of paired rows or card footers. C colours,
fonts, theme selection and Owlbear's independent build are unchanged.

Passing checks: all 12 existing spellbook/inventory component tests, frontend and
server types and production build; 32 offline headless cases using actual built
styles and SSR-rendered components. Cases cover classic/Folio, compact/comfortable,
owner/player, 390px mobile, a 500px sheet inside a 1100px browser, and wide
1100/1380px sheets. They measure equal disclosure widths across varied actions,
attunement/treasure and permissions, no horizontal row overflow, retained owner
removal controls, and unchanged opposite-column positions after opening either
side. These are synthetic layout checks, not live campaign/session interaction.

The package reconstructs the exact 568-file tracker-editor deployment
`dpl_8qs7ysSJpyELFZ31TSYe5wL859P3` and changes one CSS file only. Runtime source
hashes of all other files, including the current parity API and every component,
are retained. The working checkout's older unpublished backend changes are not
deployed. Evidence, preimages/overlay, manifest and guarded release helper remain
in `.local/entry-widths-20261111/`; review on 11 December 2026. Temporary source and
isolated browser profiles close in finally and use managed workspace cleanup;
existing dependencies and two test workers are reused, with filesystem cache off.
No live campaign writes or new account permissions occur.

Live on both website aliases and the production pointer as
`dpl_DeG256XUPhRvkWF5yUFi2eeV1Bdp`:
https://dndoldal-hs68ejr4m-dndenjoyerstudio.vercel.app.
All 568 hosted source hashes match the frozen candidate; region/environment
variable names and existing secondary website authentication are preserved.
Public/authorized JSON health checks pass; anonymous character reads return JSON
401. Both Owlbear aliases remain at `dpl_pbH4Z99bAWx34cKfyvSFwtepBeUg`.
Workspace check reports zero managed scratch runs and zero filesystem module cache.

Guarded traffic-only rollback while this release remains current:
`node .local/entry-widths-20261111/release.mjs restore`.
It accepts only candidate/baseline website aliases, checks unchanged Owlbear
aliases, preserves unrelated newer deployments and leaves metadata untouched.
Website rollback baseline: `dpl_8qs7ysSJpyELFZ31TSYe5wL859P3`.

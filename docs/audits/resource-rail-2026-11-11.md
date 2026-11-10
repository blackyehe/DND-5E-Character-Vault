# Resource rail B and learned spell visibility — 11 November 2026

The user selected B from the retained narrow-rail comparison. Folio now groups
spell levels inside one padded panel with inset level rows. Resource cards retain
the chosen C theme colours, gain actual vertical gaps and side padding, and allow
long titles and notes to wrap. The casting ability sits above two equal spell
attack/save DC fields. The normal wide tracker layout is unchanged. A common
recovery label appears only for identical slot recovery rules; mixed short/long
pools label each row. Spending, restoration, rests and permissions are unchanged.

The underlying regression was a legacy display:block/zero-side-padding rail rule
combined with the newer C backgrounds. Rail geometry now explicitly uses grid
spacing. Production-style checks also caught the old three-stat component's
last-child font rule reducing the save DC; the rail overrides it explicitly.

The user also reported that level-up had not added Volenta's selected spells.
Read-only authenticated character/definition requests confirmed level 7, a level
4 slot, Wall of Fire and Elemental Bane in known spells, and neither in prepared
spells. The save succeeded: the default prepared-only sheet filter hid them.
The spellbook now includes unprepared spells by default and explains that newly
learned spells remain unprepared. Existing Prepare controls and the optional
prepared-only filter remain. No automatic preparation or campaign write occurs.

The release reconstructs the exact 567-file level-up A deployment
`dpl_AZ4iFNNnUkaTM2A7NENAP3ffTEt4`, overlaying three frontend runtime files and
two tests. It preserves the deployed parity API, all unrelated source hashes,
Owlbear aliases, hosting configuration and existing secondary website protection.
This checkout contains older unpublished backend changes and is never deployed
wholesale. No live campaign data is retained in test artifacts.

Validation and release receipts are retained in `.local/resource-rail-20261111/`;
the five exact reviewed inputs are retained under its `overlay/` for future
baseline reconstruction. Review on 11 December 2026. Temporary sources and isolated browser profiles use
managed workspaces, existing dependencies, and finally cleanup. Tests use two
workers with filesystem caching disabled. Layout probes use synthetic offline
characters and actual built styles, rather than a live gameplay/session check.

Passing checks: 26 focused tracker, spellbook, rest and level-up tests; frontend
and server types; production build; 16 actual-CSS geometry cases covering
252/288/390-pixel rails and the 1100-pixel normal grid, compact/comfortable
density and Obsidian/Folio palettes. Probes verify card gaps/padding, count
alignment, matching spell-stat type sizes and no horizontal card overflow.
Workspace check reports zero managed scratch runs and zero filesystem cache.

Live on both website aliases and the production pointer as
`dpl_B4fgqoL5QaA3hBoKraSvaXHD2cMD`:
https://dndoldal-r8dqc6vso-dndenjoyerstudio.vercel.app.
All 567 hosted source hashes match the validated manifest. Region, environment
variable names and the secondary website's existing Vercel authentication policy
are preserved. Public/authorized health checks pass; anonymous character access
returns JSON 401. Both Owlbear aliases remain at
`dpl_pbH4Z99bAWx34cKfyvSFwtepBeUg`. No live campaign writes occurred.

Guarded traffic-only rollback while this release remains current:
`node .local/resource-rail-20261111/release.mjs restore`.
It accepts only the candidate/baseline website aliases, checks unchanged Owlbear
aliases, preserves unrelated newer deployments and leaves metadata untouched.
Website rollback baseline: `dpl_AZ4iFNNnUkaTM2A7NENAP3ffTEt4`.

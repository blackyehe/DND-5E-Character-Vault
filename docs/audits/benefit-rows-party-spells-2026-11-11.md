# Benefit sources and party spell references — 11 November 2026

The user asked to handle quicker outstanding tasks first. This increment covers
duplicate Benefit sources and the existing spell list in the party combat preview.
It reuses approved B spell rows and C theme surfaces; no new visual direction,
layout controls or player write permissions are introduced.

`characterBenefitRows` now returns one equivalent grant per source, value, unlock
level and activation state. Imported namespaces, equivalent supported enum values
and granted-spell object field order do not create duplicate rows. Unknown
payloads retain their complete identity. Different sources, bonus values, spell
casting abilities and active/inactive copies remain distinguishable. Imported
race modifiers, property flags and Workshop projections no longer list the same
resistance repeatedly. Numeric totals already deduplicated repeated same-source
bonuses; checks preserve this behaviour and legitimate stacking across sources.
Saved definitions and campaign records are not rewritten.

The party combat preview reuses `SpellbookEntry` and the existing shared
`spellProfile` calculation for its ordinary known/prepared spell list. Headers
show the recorded sheet casting ability and current active attack/save bonuses.
Expanded references retain bold casting labels, full descriptions, higher-level
rules and known/prepared status. Prepared-first ordering, search, native
independent disclosures and the Full spellbook navigation remain. Missing rules
remain explanatory rather than receiving guessed mechanics. These rows do not
roll, prepare, learn, spend slots or save. Granted spells remain available on the
full sheet; adding them to the party's compact list is outside this increment.

This package reconstructs `dpl_7zBG86TXmqmuQ89b95z923YbWKwf` (570 exact inputs),
changing two runtime files and one existing test, and adding one component test
(571 inputs). Every unrelated hosted file, prior propagation fix, sheet alignment
and parity permission is preserved. The checkout's older extension differences
are excluded. Both Owlbear aliases stay on `dpl_pbH4Z99bAWx34cKfyvSFwtepBeUg`.

Frozen-package validation covers 153 focused tests, all 19 local MongoDB/HTTP
scenarios, frontend/server type checks, production build and local browser cases
at 390/1100px. The browser fixture loads real theme/sheet/party CSS and local fonts,
intercepts every API request and blocks external origins. It checks a single
resistance source row, attack/save readouts, expansion without opening another
spell, complete casting/scaling text, equal widths, nontransparent theme surfaces,
no row overflow and zero writes. A visual check corrected the test fixture's
missing real room wrapper before the final run. No production UI or campaign
session is driven. Temporary source, Vite cache and browser profiles use the
managed workspace helper and close in finally; dependencies are reused.

Exact preimages/overlay, manifests, concise evidence, selected synthetic screenshots
and guarded release receipts are in `.local/benefit-rows-party-spells-20261111/`;
review on 11 December 2026. An expired hosting credential was refreshed through
the installed CLI's normal whoami flow; account settings and permissions were
not changed.

Live on both website aliases and the production pointer as
`dpl_Hr7CznKcHvTNh3xU1p9oWdD3RhCN`:
https://dndoldal-i0oclt978-dndenjoyerstudio.vercel.app.
All 571 hosted input hashes match the frozen candidate. Region, environment
variable names and secondary website protection are preserved. Public/authorised
JSON health checks pass; anonymous character access remains JSON 401. Both
Owlbear aliases are unchanged. No live campaign records were written. Workspace
check reports zero managed scratch runs and zero filesystem module cache.

Guarded traffic-only rollback while this release remains current:
`node .local/benefit-rows-party-spells-20261111/release.mjs restore`.
It preserves unrelated newer deployments and requires both Owlbear aliases to
remain unchanged. Rollback baseline: `dpl_7zBG86TXmqmuQ89b95z923YbWKwf`.

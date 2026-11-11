# Compendium propagation follow-through — 11 November 2026

The user authorised fixing the three remaining gaps found in the Compendium
audit, starting with granted spells, followed by weapon attacks and generic
option traits. The existing inline A comparison and explicit Update confirmation
remain the route for applying a newer source edition to existing characters.

- Affected-character detection includes active race, option and inventory spell
  grants, even without known/prepared entries. Reviewed sheet references retain
  the grant's source-owned spell key across native spell fingerprints, including
  expired ordinary aliases. Grant keys, known/prepared lists and slots are kept.
- Reviewing a weapon updates matching source-derived saved attack fields,
  including name, dice, type, range, ability and magic bonus. Custom field values,
  additive damage, notes and flags remain. The full comparison includes attacks,
  and the version-guarded transaction persists them. Previously approved updates
  can also repair an attack that still matches the captured older source.
  Ambiguous same-named inventory copies and removed weapon definitions retain
  their attacks with a manual-review warning.
- Generic option traits reconcile additions, changes and removals using a small
  persisted source identity. Stable trait IDs preserve rename identity; legacy
  name links must be unambiguous. Identical imported background projections are
  deduplicated. Custom or ambiguous traits remain with a review warning. Selected
  option acquisition rows, chosen levels, choices and local display flags remain;
  new child traits respect the acquisition level. Removing the parent selection
  removes its source-owned child rows through the existing selection save path.
  Internal provenance-only changes are omitted from the visible comparison.

Ability-score grants, prerequisites and changed player choices still require
manual review; no new inference or blanket campaign mutation is introduced.
The existing definition revision/source guard, owner checks, character timestamp,
review hash, blocked selections and atomic per-character write remain in place.
No production campaign records were written during development or release.

The release reconstructs the exact 570-input inline-update deployment
`dpl_FFk7saKgXK5KCiNcJYym4TDhESDq`, changing six runtime and three test inputs.
Unrelated checkout differences, sheet styles and parity API files are preserved.
Both Owlbear aliases remain on `dpl_pbH4Z99bAWx34cKfyvSFwtepBeUg`; its independent
client is not redeployed. The shared website reference fix is also used by the
existing extension sheet endpoint.

Frozen-package validation passes: 176 focused tests, 19 real local MongoDB/HTTP
scenarios, frontend/server types, production build and the existing 390/1100px
save/review UI scenarios. Three compatibility test files absent from the hosted
manifest are validation support only. Fixtures cover granted-only spell reviews,
fingerprint/alias retention, persisted weapon attacks and damage comparisons,
trait replacement, stable acquisition rows when the last trait changes,
custom-text retention, provenance persistence and parent removal. The fixture
databases, servers, browser profiles and frozen source use
managed temporary workspaces and finally cleanup; no filesystem module cache.

Exact preimages, approved overlay, manifests, concise checks and guarded release
receipts are retained in `.local/definition-follow-through-20261111-r2/`; review
on 11 December 2026. The first unassigned staging build and preimages remain in
`.local/definition-follow-through-20261111/`, marked superseded after the final
acquisition-row stability check. It received no alias traffic. These recovery
inputs are not disposable scratch.

Live on both website aliases and the production pointer as
`dpl_7zBG86TXmqmuQ89b95z923YbWKwf`:
https://dndoldal-4bzs309bv-dndenjoyerstudio.vercel.app.
All 570 hosted input hashes match the frozen candidate. Region, environment
variable names and the existing secondary website protection are preserved.
Public/authorised JSON health checks pass, anonymous character access returns
JSON 401, and both Owlbear aliases remain unchanged. Workspace check reports
zero managed scratch runs and zero filesystem module cache.

Traffic-only rollback while this release remains current:
`node .local/definition-follow-through-20261111-r2/release.mjs restore`.
It checks both website aliases and unchanged Owlbear aliases, refuses unrelated
newer traffic and leaves administrative metadata untouched. The rollback baseline
is `dpl_FFk7saKgXK5KCiNcJYym4TDhESDq`.

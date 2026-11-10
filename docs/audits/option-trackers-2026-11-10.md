# Linked character-option trackers - 10 November 2026

Workshop Character options and Compendium editing share a Linked trackers step.
Feats, backgrounds, subraces, invocations, boons, choice groups, languages and
references support named pools with permanent UUIDs, 1-999 uses, short/long/manual
recovery, notes and a character unlock level. Classes and races retain their
existing Workshop resource editors. These are whole-option pools, not separate
grants on individual choice nodes. Existing form styles and resource cards are
reused; no aesthetic redesign is included.

Acquisition captures the approved definition and immediately derives its pools.
Counters belong to the character's approved source snapshot, keyed by tracker
UUID. Native option identity remains stable through content fingerprint changes.
Review/apply carries counters forward through renamed sources/pools, reordered
definitions, maximum/recovery changes and additions. Lowering a maximum preserves
overspent uses. New pools start unused; removed pools and removed grants lose their
counters. Temporarily level-gated pools retain uses and recover on eligible rests
while their grant remains owned. Source edits remain pending until owner review.

Players can spend/recover configured pools, but cannot submit definitions or alter
maxima. Hidden pools cannot be spent. Concurrent play invalidates stale source
reviews. Canonical output and writes fold older derived resource-row counters into
the source snapshot and discard orphan derived rows. Explicit authored feat pools
replace legacy automatic guesses, including an explicit empty list; existing
manual trackers are not matched or converted by name. Deleting a source pack does
not silently delete a character's approved grant.

The release uses `scripts/releases/option-trackers-2026-11-10.json` to reconstruct
the current website deployment `dpl_7eDtt8S2qHaqymXAqiEjzUEfFLPU`, then overlays
the scoped files. Previously unpublished extension-controller changes are excluded.
The earlier multiline option/speaker field fix is deliberately included in the
same option editor, with its regression tests. Other preimage differences are
line endings only. Exact small preimages and release receipts are retained in
`.local/option-trackers-20261110/` for reconstruction/rollback; review them on
10 December 2026. Disposable source and database fixtures use managed workspaces,
close processes/connections before cleanup, and reuse installed dependencies.

Validation covers all option grant categories, acquisition, owner/player spending,
source rename across native fingerprints, both editors, added/removed pools,
reduced maxima, level gating, rests, stale reviews, grant removal, manual tracker
preservation, incomplete drafts and compatibility with existing item pools.
Tests and deployment do not rewrite live campaign records. Independent Owlbear
aliases remain on their separate deployment and require their own release.

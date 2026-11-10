# Editable inferred trackers — 11 November 2026

The user requested direct editing/removal of inferred counters such as Volenta's
Zhaerin Contractor uses. The Resources editor now offers Edit tracker and Remove
tracker for automatic, unlinked pools. Edit switches to character-specific values
without resetting spent uses; changing a name or note also makes the override
explicit. Previously those edits could remain automatic and be recalculated away.
Names, notes, fixed/scaled maxima and recovery use the existing fields.

Removal keeps the existing zero-maximum/manual override so inference cannot
recreate the counter. The row leaves the active editor list and playing sheet;
Removed automatic trackers offers an explicit restore using the current rules
and a fresh pool. Legacy disabled rows appear there too. Adding/deleting other
custom counters retains these suppression records. If the original grant is no
longer active, restoration is unavailable. The granting feat/feature is unchanged.
Existing Automatic mode restores a customised active pool to its feature rules.
All operations remain draft edits until Save; no real campaign records are edited
by the release. Source-linked item/option and Workshop class rules retain their
source controls; this change does not detach them or expand player permissions.

The release overlays one frontend runtime component and two tests on the exact
567-file resource-rail B deployment `dpl_B4fgqoL5QaA3hBoKraSvaXHD2cMD`.
It adds the ResourceEditor regression test, producing 568 source inputs. No
backend runtime, resource schema, inference/rest policy, Owlbear release or hosting
configuration changes. The working checkout's unpublished backend differences
are excluded. Reconstruction/preimages, exact overlay and guarded traffic restore
remain under `.local/tracker-editor-20261111/`; review on 11 December 2026.

Tests cover direct edits, spent-only updates, overrides/Automatic mode, removal,
restoration, retained suppression through other edits/reload/level changes/rests,
protected source rules and unavailable grants. An isolated MongoDB/HTTP scenario
round-trips overrides and removal through the real character endpoints and checks
retained feats/unrelated spent counters. Fixture databases and source workspaces
use the managed temporary helper and finally cleanup, existing dependencies and
two workers without filesystem module caching. No production writes or new grants.

Passing checks: 19 focused editor, linked-option and rest tests; all 16 isolated
MongoDB/HTTP scenarios; frontend/server type checks and production build.
Workspace check reports zero managed
scratch runs and zero filesystem module cache.

Live on both website aliases and the production pointer as
`dpl_8qs7ysSJpyELFZ31TSYe5wL859P3`:
https://dndoldal-2y50vllfh-dndenjoyerstudio.vercel.app.
All 568 hosted source hashes match the frozen candidate. Region, environment
variable names and existing secondary website protection are preserved.
Public/authorized JSON health checks pass; anonymous character access is JSON
401. Both Owlbear aliases remain at `dpl_pbH4Z99bAWx34cKfyvSFwtepBeUg`.
No live campaign writes occurred.

Guarded traffic-only rollback while this release remains current:
`node .local/tracker-editor-20261111/release.mjs restore`.
It accepts only candidate/baseline website aliases, requires unchanged Owlbear
aliases and preserves unrelated newer deployments. Metadata remains untouched.
Website rollback baseline: `dpl_B4fgqoL5QaA3hBoKraSvaXHD2cMD`.

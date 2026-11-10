# Linked item trackers - 10 November 2026

Normal and magic item authoring, create-and-give, and Compendium item editing
offer Linked trackers. Each tracker has a UUID, name, 1-999 maximum uses, recovery
(short/long/manual), availability (carried/equipped/attuned), and notes. Equipped
trackers respect required attunement. Attuned-only trackers require the item's
Requires attunement setting. The existing item form and resource cards are reused.

Counters belong to the inventory instance, keyed by tracker UUID. Labels and array
positions do not identify counters. Each inventory entry has its own pool;
quantity does not multiply the maximum. New deliveries start fresh and retries do
not duplicate deliveries or refill existing items. Source templates do not capture
a character's spent counters.

Temporary deactivation and quantity zero hide applicable trackers while retaining
spent uses. Actual item removal takes its counters with it. Definition removals
prune their counters through review/apply. Renames, maximum/recovery changes and
added trackers use the existing explicit source review, preserving old usage even
when it exceeds a lowered maximum. New trackers start at zero. A newly delivered
copy records its current source edition so an older character-wide approval does
not downgrade it while other copies await review.

Website resource actions save uses on the item. Derived rows are stripped from
canonical writes; older resource-row counters are folded into the item when read
or reconciled. Hidden, still-carried items recover on the configured rest; manual
pools do not. Players can update counters and allowed equipment state, not tracker
definitions. Hidden pools cannot be spent. Concurrent play invalidates an older
definition review before it can overwrite counters.

This stage handles configured item trackers. Feat/other option authoring is a
later source adapter using the shared tracker definition and stable identities.
Existing manual trackers are not guessed or linked by name. Independent Owlbear
aliases remain unchanged; they need a separate release to expose the new pools.

Validation uses `scripts/releases/item-trackers-2026-11-10.json` and the shared
release harness. It reconstructs `dpl_2obs3AK3DTVgkTbtn5Dv4sGnaSur` exactly and
overlays the scoped files. The character type's hosted preimage differs only in
mixed line endings. Previously unpublished extension-controller changes are
excluded. Small receipts/preimages are retained in `.local/item-trackers-20261110/`
for release reconstruction and rollback; review them on 10 December 2026.

Checks cover acquisition, independent copies, state after reload, owner/player
spending, inactive recovery, duplicate/invalid definitions, source renames and
added/removed trackers, reduced maxima, stale reviews, item removal and legacy
resource-row compatibility. Real MongoDB fixture tests close their server,
connections and managed database process before cleanup. Tests and deployment
do not rewrite any live campaign character or item.

Deployment and final validation receipts follow after promotion.

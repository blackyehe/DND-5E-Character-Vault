# Item Workshop and delivery

The Item Workshop is under Homebrew Workshop → Normal & magic items. It creates
normal and magic weapons, armour/shields, accessories, consumables, treasure and
gear. The same creator is available in character Edit and Equipment, and through
the DM room's Give item button. It can copy SRD definitions or start from scratch.

Actions are explicit:

- **Add to character draft** waits for Save character.
- **Give item now** saves directly, independently of the character editor's spell
  and permanent-stat validation. It is an ownership-checked inventory-only write.
- **Save to my item library** stores a reusable server-side Workshop template.
- **Save item & update characters** updates linked template copies automatically,
  as confirmed by the user. Counts, equipped state, attunement, IDs and delivery
  receipts are preserved. Changes never overwrite HP, slots or other play state.

Custom templates use the existing CustomContent collection (`type: item`), so
complete site backups/restores include them. Given items also carry their full
definition, so assigned players do not need to import the DM's library.

## Inventory integrity

Delivery has a client-generated request UUID saved as the item's grantId. Retrying
the same delivery does not duplicate loot. Character updates use compare-and-set
against updatedAt and retry against fresh inventory after a concurrent play
action. Template synchronization similarly retries and uses template revisions
to prevent an older save from replacing newer copied rules. Busy sheets that
cannot be updated are explicitly reported for retry.

Normal/magic references load independently of the larger class/spell editor
library. The older editor only added items to an unsaved draft, and its reference
options were gated on unrelated full-library requests. The new workflow clearly
distinguishes staging an item from immediately delivering it.

Room sheets check for updated saved data every three seconds while visible, in
addition to the existing roster refresh. Draft editing and local Player view
experiments pause these sheet refreshes. This is polling, not a persistent push
connection; remote delivery is normally visible within a few seconds.

## Effects and attunement

Ring and Cloak of Protection have +1 AC and +1 to all saving throws while worn
and attuned. They are accessories, never armour or weapons. The creator exposes
explicit AC/save bonuses and weapon/armour enchantments for custom rules; other
and conditional effects are recorded as readable rules text.

Attunement is separate from wearing, with a three-item limit and no simultaneous
attunement to duplicate magic items. Quantities do not multiply bonuses. Different
protection items stack; identical magic item copies do not. Armour retains its
mundane base AC before attunement; only its enchantment requires activation.

Legacy imported manual AC may already include worn protection items. Its initial
item contribution is recorded once as combat.itemAcBaseline, preserving the
imported total. Equipping, unequipping, attuning and changing item bonuses then
adjust the total by the actual change. Equipment-calculated AC adds accessories
to its calculated armour/shield total directly. Existing worn legacy SRD items
requiring attunement are treated as already attuned; new deliveries explicitly
start unattuned unless requested otherwise.

Players may change quantities, equipment and attunement through the play-state
allowlist. They cannot create items, change definitions, or submit stat bonuses.
The server revalidates ownership, allowed fields and attunement limits.

Targeted inventory checks cover creation schemas, item classification, duplicate
delivery, preserved play resources, attunement, protection stacking, imported AC,
and player-write restrictions. Frontend build and server typecheck also pass.

Live verification on 19 October 2026 saved an SRD Ring of Protection into the
Workshop and delivered one linked copy to Fade, equipped and attuned at the
user's explicit request. His existing room tab updated without a manual reload:
AC 17 → 18; saves +6/+3/+1/+2/+7/+0 → +7/+4/+2/+3/+8/+1. The inventory showed
one ring under equipped accessories, quantity 1, and 2/3 total attunements.
Saving the unchanged template then reported one character updated, preserving
the copy's quantity and activation state. The empty-reference BSON-null issue
found during this check is covered by a regression case. The 19 focused tests
also include fast sheet-opening and temporary Player view regressions.


## Item forms, tags and detail fields — 19 October 2026

The shared item creator now offers every standard base weapon (including special,
non-damaging weapons) and light/medium/heavy/shield armour groups with matching
base forms. Choosing a base copies physical stats, weight and reference rules;
custom names, descriptions, bonuses and tags remain editable. Standard custom
base choices use bundled rules immediately, without waiting for an external
SRD detail request. Changing a normal
base also changes its default price unless the DM entered a custom value.
Magic items have no assumed price.

Accessory categories distinguish wondrous items, rings, rods, staves and wands.
Form tags include necklaces, amulets, cloaks, boots, gloves, belts, bracers,
headwear, eyewear, robes, bags, instruments, tattoos and figurines. Additional
comma-separated tags are supported. Tags are descriptive, not equipment limits.
The user approved rarity, optional value/currency and attunement eligibility
notes. Eligibility remains a DM check; charge trackers were explicitly deferred.

The Workshop, item picker and Compendium share category, base weapon, damage,
armour group/base, tag, rarity and attunement filters. Custom tags appear as
filter choices and are searchable in character inventories. Saved personal
Workshop definitions appear in the Compendium alongside SRD equipment. Player
sheets receive their assigned item's full saved metadata, without requiring the
player to import its source library. These fields survive template updates,
giving, character saves and backups. Existing SRD-linked definitions are enriched
on read; no bulk character mutation is needed.

Search metadata is generated locally from bundled SRD data using
scripts/update-item-search-metadata.ts, preserving existing allowed-base and
bonus-damage classifications. Frontend build and server typecheck passed for
this addition. No automated tests were added or run for this pass.

Live form review confirmed Longsword fills 1d8 slashing, Martial training and
3 lb.; Medium armour limits the base menu to the five matching forms. The
existing Ring of Protection library entry acquires its Rare rarity on read.
No example items were saved or given during this addition.

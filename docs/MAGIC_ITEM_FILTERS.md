# Magic item filters

The Compendium's magic item list and descriptions still come from the configured
2014 SRD API. A small bundled index supplies category and permitted weapon/armour
forms without requesting every item description when the page opens.

`src/lib/magic-item-filter-data.json` records its pinned upstream source. To refresh
it, download the English 2014 `5e-SRD-Magic-Items.json` and `5e-SRD-Equipment.json`
from that provider and run:

```powershell
node scripts/build-magic-item-filters.mjs <Magic-Items.json> <Equipment.json>
```

The generator derives permitted forms from the rules header and base damage from
equipment records. Its explicit extra damage map covers weapon special attacks;
update that map when new weapons are added. Sun Blade replaces normal weapon
damage with radiant damage. Resistance and spell damage are excluded. Staves and
ammunition retain their own SRD categories, separate from the weapon filters.

Combined weapon and damage filters are checked against the same permitted weapon
form. Generic weapons can match multiple forms. Unknown upstream entries remain
visible with all filters cleared, with a notice that their tags are unavailable.

# Playtest follow-up, 19 October 2026

Implemented from the supplied feedback file; the user confirmed that DM sheets
should open on Summary by default.

- Room DM view has Summary as its first tab, with a centered compact summary.
  The old summary disclosure above every tab is removed. Player summaries remain
  visible beside their sheet.
- Edit → Equipment includes SRD magic items. Applicable templates require a base
  weapon/armour, restricted to the allowed forms from the compendium metadata.
  The selected item retains its magic reference, rules, base statistics and
  unconditional attack/AC enchantment. Items remain drafts until Save character.
- Weapon names in Combat expand their full item rules. Inventory and attacks use
  the same paragraph deduplication, retaining unique base properties and notes.
  Kaylee's saved magic descriptions were duplicated in the reference field, which
  additionally contained base weapon properties; the display now handles this.
- Resource names offer a hover/focus preview and click/tap dialog. Descriptions
  come from the saved character features and feat library, with tracker notes
  included. Closing suppresses the preview until the next deliberate interaction;
  scrolling or resizing dismisses it. Missing descriptions are identified.
- Eligible Revenant Shadow characters have a Shadow Champions tab in DM and
  player views. This follows the class, not Fade's identity. Creation also retains
  its existing companion preview.

## Room companion access

Every champion list/sheet/reference read first checks access to the source
character: room membership, assignment (or ownership for the DM), and current
character ownership. The source must be a Revenant Shadow. Only the owner's
characters explicitly marked `shadow-champion` are exposed. Access therefore
ends when the assignment or membership ends. Other owner characters, packs,
external import data and write endpoints are not exposed through this path.

Companions open separately using the same full sheet tabs and progressive loading
as ordinary characters. The room companion view is clearly marked as a reference
preview: resource experiments are local and temporary, and permanent Edit is
absent. The DM can edit the original through their ordinary character library.

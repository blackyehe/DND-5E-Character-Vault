# Compendium filters and spacing — 21 October 2026

## What changed and why

The Magic items filter panel touched the panels below because it inherited the
character sheet's `margin: auto` and padding. The Compendium now owns its layout:
18 px between panels on desktop and 14 px on narrow screens. Results and details
remain independently scrollable, and stack on screens narrower than 768 px.

Each content category now has filters derived from its recorded metadata.

| Category | Filters |
| --- | --- |
| Spells | Level/cantrip, school, class spell list, casting time, concentration, ritual |
| Monsters | Creature type, size, minimum/maximum challenge rating, movement |
| Classes | Hit die, saving throw proficiency, spellcasting ability |
| Races | Size, walking speed, ability bonus, language |
| Subraces | Parent race, ability bonus, language when recorded |
| Subclasses | Parent class |
| Backgrounds | Skill and tool proficiencies |
| Feats | Prerequisites, ability increases |
| Languages | Standard/exotic type and script |
| Invocations | Prerequisites, explicitly stated required level and pact |
| Boons | Pact when recorded, description availability |
| Selections | Number of available options, option type when recorded, description availability |
| Other reference | Reference type when recorded, description availability |
| Items / Magic items | Existing item filters, plus the shared library/source controls |
| Homebrew files | Filename and included content type |

Content tabs also offer Library and Source filters. Matching uses all selected
filters together. Clear filters resets category, library/source and item filters;
the separate text search retains its text. Switching categories resets filters.
Counts show matching entries out of the loaded category total. If an entry is
filtered out, its detail view closes, including a pending detail request.

## Incomplete imported data

Filters do not invent missing rules. Where some entries lack a value, supported
dropdowns offer **Not recorded**. A field absent from the entire category is
omitted. An entry without a value will not match a specific value selected for
that field; clearing filters makes it visible again. Subrace size/speed are not
inferred from normalization defaults. Challenge rating zero remains a valid value.
Invocation level/pact requirements are read from explicitly labelled prerequisites,
not guessed from descriptive spell text. No character rules or saved data changed.

## Loading behaviour

Text searches and filter changes narrow the already loaded list locally. Typing
no longer reloads the authenticated homebrew catalog on every search. Dropdown
options come from the full category, so narrowing a search does not remove the
selected filter's option.

Standard references previously supplied only names and links. The new public
`/api/2014/compendium/:kind` endpoint supplies names, links and compact metadata
for the selected category. It does not fetch every entry's description. Full
descriptions still load on selection. The server index is about 148 KB on disk
across eight categories; each request returns only one category. Spells use the
existing local spell snapshot. Private homebrew remains behind account access.

The metadata uses the project's existing pinned 2014 SRD database revision:
`85acb251dad0b044a72c554c2d7f2d0c11e43504`. Licensing and source notices remain in
`server/data/README.md`. Rebuild the eight-category metadata file with:

```powershell
node server/node_modules/tsx/dist/cli.mjs scripts/update-compendium-index.ts
```

## Review performed

- Frontend and server TypeScript checks passed; production build passed.
- Manually reviewed every category with the supplied all-content Orcbrew file.
- Combined spell level 3 + Evocation + SRD returned seven entries, including Fireball.
- Beast + minimum CR 1/4 + maximum CR 1/2 + SRD returned 24 entries.
- Checked hit die, ability bonus, parent race/class, skill, feat ability increase,
  language type, invocation pact and selection-size filters against real entries.
- Checked existing magic weapon + Longsword filters, empty states and clear controls.
- Checked imported-file filename search and reset using disposable local data.
- Narrow review: 390 px frame (375 px content viewport after scrollbar), no horizontal
  overflow or overflowing dropdowns; 14 px vertical gap. Wide review: 1440 px frame,
  18 px vertical/horizontal panel gaps and aligned result/detail panel tops.
- Live site health returned OK; public monster metadata returned 334 SRD entries.
- Verified live filters and the Fireball description; no browser warnings/errors observed.
- No automated test suite was added or run.

Live screenshot: `.preview.local/compendium-filters-live-2026-10-21.png`.

## Release and rollback

- Implementation commit: **c7d1245**.
- Git checkpoint: **pre-compendium-filters-2026-10-21**, pointing to **47421b0**.
- Live deployment: **dpl_DLxxhoPFfVrcjVJ72TJQ2hN31sfq**.
- Deployment URL: https://dndoldal-3gjttq5fs-dndenjoyerstudio.vercel.app
- Public site: https://dndoldal.vercel.app/compendium
- Previous production deployment retained: **dpl_AJRy8WDEPDpinXCoPyce9djzVkz1**.

To restore the preceding production version:

```powershell
vercel rollback dpl_AJRy8WDEPDpinXCoPyce9djzVkz1 --scope dndenjoyerstudio --yes
```

The Git checkpoint and prior Vercel deployment both remain available. There is no
database migration to reverse.

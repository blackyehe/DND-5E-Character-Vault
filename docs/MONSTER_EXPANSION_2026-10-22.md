# Monster grouping and builder expansion

Implemented on 2026-10-22. Publication authorized after duplicate review.
No monster deletion, mass import, account content writes, or T3 Code restart.

## Fresh account check

An authenticated GET of `/api/content/homebrew/monsters` returned 680 active
entries. Its sorted name/source list exactly matched the preceding audit. There
are 666 distinct normalized imported names and 14 repeated-name groups. Combined
with the four previously audited standard/import swarm overlaps, there are 18
same-name groups in the current 1,014-entry combined library.

The current account contains one raw **Duergar Soulblades** entry, sourced to
**Mordenkainen's Tome of Foes**. No raw imported name ends in a recognized book
label/acronym in this snapshot; the displayed full book label is metadata. This
does not imply that the three public-source listings have identical rules.

The 14 imported groups rechecked were:

- Aberrant Spirit
- Alchemical Homunculus
- Bestial Spirit
- Celestial Spirit
- Dancing Item
- Elemental Spirit
- Fey Spirit
- Fiendish Spirit
- Homunculus Servant
- Iron Defender
- Shadow Spirit
- Steel Defender
- Undead Spirit
- Wildfire Spirit

Most span published and UA sources. Homunculus Servant and Steel Defender also
span Eberron and Tasha's. These remain source versions, not destructive merges.
See [the prior candidate review](MONSTER_DUPLICATE_NAME_REVIEW_2026-10-22.md)
for spelling, form, option, and related-name candidates.

## Implemented behavior

- Monster Compendium uses one browse listing per identity, with selectable
  source/form/version definitions. Filters apply before grouping. An excluded
  selected version is cleared, preventing a hidden statblock from remaining open.
- Known full source titles and acronyms normalize to the same source ID and
  source filter. Arbitrary suffixes are not stripped. Editions remain separate.
- Repeated source-label copies share one selector choice only when every raw
  field except root name/key/source/disabled/editor labels is exactly equal.
  Comparison includes prose and unsupported fields, and requires the same
  normalized creature/form name, source, edition, and variant. All original IDs
  remain retained. Sparse standard indexes cannot prove equivalence.
- Published choices sort before UA. Reviewed form/option families use an explicit
  allow-list; replacement links and mere stat similarity never merge identities.
- Reviewed spelling corrections affect display/search, preserving stored names.
  Vampire Spawn, Blood Drinker Vampire, Mind Drinker Vampire, and Vampiric Mist
  remain distinct from the Vampire family.
- Builder supports source ID/edition/page/URL, aliases, browse family/version,
  multiple size choices, habitat, treasure, initiative bonus and printed score,
  lair XP and XP conditions, formula HP/AC, and alternative conditional AC.
- Unknown statistics remain unrecorded. Derived HP/AC are withheld when their
  required ability scores are unknown. Fixed HP does not invent a CON-based roll.
- Structured spellcasting retains independent printed DC/attack overrides,
  arbitrary usage/slot lists, source-qualified spells, introductions, exceptions,
  and placement in any rule section. Combined melee/ranged attacks have separate
  reach and range. Complete written rules remain available.
- Optional metadata keeps version-1 drafts compatible. New fields round-trip
  through strict validation, native Orcbrew storage, read-back, and exports.
- Known 5etools inline tags become safe plain text, retaining reference sources.
  Unknown tags remain visible. No HTML is executed or edition fallback inferred.
- Original material and unmapped-field notes can be retained in drafts, saved
  packs, Orcbrew exports, and account backups.
- Optional Info fields provide separate lore/background text, attribution, and
  artwork URL/title/artist credits in the builder and reader. Markdown, PNG,
  print, Orcbrew and backups retain lore and artwork citations. Artwork is an
  explicit external link, not an automatically downloaded image. Unsafe URL
  schemes and credentials in URLs never become clickable links.

## Info data verification

The live [fluff index](https://5e.tools/data/bestiary/fluff-index.json) maps 95
sources to separate lore/art files. The checked
[XMM file](https://5e.tools/data/bestiary/fluff-bestiary-xmm.json) contains 588
fluff records, including 340 copy/inheritance records. These are not counts of
unique monsters with complete lore. The Aeromancer inherits Aarakocra lore and
prepends its own section; the parent includes image metadata and artist credit.
Info content is available where supplied, not guaranteed for every statblock.
Future import must resolve name/source identities, copy modifications, nested
entries and internal artwork paths before populating the optional fields. This
release adds storage/editing/presentation support, not automatic lore loading.

## Validation

- Frontend production build and server TypeScript check pass.
- 35 targeted tests pass, including real validation → Orcbrew serialization →
  parse → statblock → Markdown round trips; grouping; raw copy equivalence;
  distinct forms; malformed identity metadata; old drafts; unknown statistics;
  conditional rules; printed spell overrides; and source-qualified references.
- Local browser checks used isolated fixtures with all write requests blocked.
  Three Soulblade source labels produced one listing/one exact-copy choice;
  Vampire displayed four distinct choices with UA last; changing to Bat Form
  changed the loaded heading; a UA source filter excluded and cleared Bat Form.
  Full source titles/acronyms yielded one MTF filter option. At 1280px, no document
  horizontal overflow was detected. Initiative, lair XP, formula HP, and spell
  source/DC edits updated the preview; extended fields persisted in device drafts.
- A separate local component check verified Info fields update the rendered lore,
  decode source-qualified tags, display attribution and artwork credits, and
  create a safe external link without fetching images or overflowing the page.
- The final pre-publication authenticated library check returned the same 680
  monsters and one raw Duergar Soulblades entry. No new blocking name clash was
  found. Audit/design documents are now excluded from Vercel uploads.
- Native screenshot/snapshot capture timed out; UI verification used rendered
  DOM text, actual controls, selected values, and layout measurements.
- The full existing suite reported six unrelated failures: one character-builder
  expectation for an equipment index and five content-route JSON failures.
  All six were reproduced from an isolated archive of unchanged HEAD. Temporary
  baseline files and test harnesses were removed after verification.

## Published release

- Public site: https://dndoldal.vercel.app
- Ready deployment: `dpl_98F1wBxDw7KJyQMPpJfooAgPRouC`.
- Deployment URL: https://dndoldal-7rd7g5618-dndenjoyerstudio.vercel.app
- Production-domain inspection confirmed the new deployment and alias.
- `/api/health` returned HTTP 200 with `{"ok":true}`. The production entry asset
  is `index-DH-OBcE5.js`; the Workshop bundle contains the new Info controls.
- The live authenticated Compendium reports 853 creature listings covering all
  1,014 source entries. The account still contains 680 imported monsters. Duergar
  Soulblade has one choice; Vampire has five source/form/variant choices, with
  Vampire Spawn and the Blood Drinker / Mind Drinker identities still separate.
- The production export-only endpoint accepted a disposable in-memory fixture
  with Info metadata and retained its lore and artist credit in Orcbrew output.
  This endpoint serializes without saving; no test pack/monster/draft was created
  in the account or production browser storage.
- The Vercel build and backend typecheck passed. Temporary local UI fixtures and
  their Vite process were removed after verification. T3 Code was not restarted.

### Rollback

The preceding Ready production deployment is retained:
`dpl_5rPKLiC6CVpoYz3mb5AUuaQvSszw`, at
https://dndoldal-r3yucsqmh-dndenjoyerstudio.vercel.app.

```powershell
vercel rollback dpl_5rPKLiC6CVpoYz3mb5AUuaQvSszw --scope dndenjoyerstudio --yes
```

Rollback restores the application without rewinding account data. It has not
been executed. Source changes remain in the workspace on
`codex/folio-sheet-rollout`, based on `4cd2e88`; no Git commit was created for
this release.

## Remaining work

This expands the existing system; it does not yet implement an automatic URL,
text, JSON, or screenshot importer. Spell references currently retain their
source/edition as text and are explicitly unverified; there is no availability
resolver or automatic substitution from the 2014 spell library. Complete
5etools dataset loading/copy resolution, import collision review, and any mass
replacement remain separate work. The current SRD catalog and account packs
remain intact.

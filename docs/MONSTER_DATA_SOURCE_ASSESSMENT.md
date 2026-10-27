# 5etools monster data source assessment

Checked: 22 October 2026. Research and migration design only. No application, account, database, or deployment changes.

## Answer

Yes: the structured files used by 5etools expose its built-in bestiary and richer statblock fields. A dedicated screen scraper is unnecessary for this source.

No documented, supported public REST API was found in the reviewed site, source repository, or linked documentation. The verified integration surface is static JSON plus internal JavaScript loading/normalization code. Internal methods are useful implementation references, not a stable external API contract.

The previous audit loaded all 112 indexed bestiary files successfully: **4,574 base entries**, plus **368 generated source versions** after resolution, for **4,942 entries**. These include reprints and editions, not 4,942 unique monster names. The current index still matches the audited index; XMM was fetched again and still contains 503 monsters.

This covers the built-in indexed bestiary. Optional user-installed homebrew and prerelease repositories are separate. Tokens, art, lore, spells, and referenced rules require additional datasets.

## Verified access paths

The JSON resources below were verified across the audit and this follow-up.

| Resource | Purpose |
|---|---|
| [Bestiary index](https://5e.tools/data/bestiary/index.json) | Maps 112 source IDs to JSON filenames |
| [Newer Monster Manual JSON](https://5e.tools/data/bestiary/bestiary-xmm.json) | 503 XMM statblocks, including the requested Aeromancer |
| [Legendary groups](https://5e.tools/data/bestiary/legendarygroups.json) | Lair actions/regional effects and associated group data |
| [Lore/image index](https://5e.tools/data/bestiary/fluff-index.json) | Maps sources to separate monster lore and image metadata |
| [Spell index](https://5e.tools/data/spells/index.json) | Referenced spell definitions, verified in the preceding audit |

The first four endpoints were fetched again for this assessment; the spell index and all 18 spell files were verified during the preceding audit.

The live site reports version 2.38.0. Its bestiary index returned Last-Modified: 14 October 2026, 21:06:46 GMT. These are observation metadata, not a guarantee of snapshot consistency across independently downloaded files.

### Downloadable alternatives and existing tools

- The site's [source-download link](https://5e.tools/index.html) leads to the [GitHub mirror](https://github.com/5etools-mirror-3/5etools-src). It contains the data and processing code. A pinned commit is a practical input for a reproducible importer.
- The site's [release archive](https://get.5e.tools/) supplies downloadable distributions. The directory reviewed here listed older packages than the live site. An archive is reproducible but must be checked for freshness.
- [Plutonium](https://wiki.tercept.net/en/Plutonium/Features-Guide/Configuration) is an existing importer for Foundry. Its documentation describes site data sources, local data copies, strict name/source matching, and tag conversion. It is not a drop-in importer for this Vue/Express application.
- The site also links Rivet and Roll20 integrations on its homepage. These target their respective VTT workflows; none was installed or run.

The application needs a focused 5etools JSON adapter, not a new external service or a Foundry installation.

## Loading the files correctly

Reviewed [upstream loader code](https://github.com/5etools-mirror-3/5etools-src/blob/main/js/utils.js) and the live page's functions:

- `DataUtil.monster.pLoadAll()` loads indexed monster sources through the site's merge/normalization path.
- `DataUtil.monster.getVersions(monster)` expands generated variants.
- `DataUtil.monster.pPreloadLegendaryGroupsSite()` and `getLegendaryGroup(monster)` resolve associated groups, including runtime-generated groups.

Simply concatenating every file's `monster` array loses inheritance and generated content. The preceding audit confirmed 1,144 raw copy parents resolve; one apparently absent legendary group also resolves through runtime generation.

For a reproducible implementation, use a pinned, locally controlled build-time conversion process. Do not execute arbitrary remote JavaScript in production. Preserve upstream license notices when reusing code. Either reuse the pinned loader in its supported environment or implement its required semantics and compare outputs against it.

Keep both source data and a normalized reader model. Preserve conditional initiative/XP, formula HP/AC, multiple sizes, nested rule entries, spellcasting position and overrides, and unsupported source fields. Resolve display tags safely. Do not flatten the imported catalog into today's more restrictive editable draft and discard the rest.

An accurate data source does not remove the need for the builder upgrades identified in the audit.

## What replacing the current SRD source means here

The repository does **not** currently store a full SRD monster database in MongoDB.

- [server/data/srd-2014-compendium-index.json](../server/data/srd-2014-compendium-index.json) supplies a small standard index of 334 monsters alongside other categories.
- [server/lib/srd-snapshot.ts](../server/lib/srd-snapshot.ts) serves that index locally. It also serves full spell/equipment/magic-item snapshots.
- [server/app.ts](../server/app.ts) proxies standard detail requests that lack local definitions through the configured SRD client.
- [src/lib/srd.ts](../src/lib/srd.ts) uses `/api/2014` and its monster reader methods.
- [src/views/CompendiumView.vue](../src/views/CompendiumView.vue) combines the standard list with account imports and loads full details on selection.

Deleting the existing index file would also disrupt other categories. Changing the general SRD API base would affect more than monsters. A monster-specific catalog provider is the appropriate replacement boundary.

The 680 imported monsters remain an independent account-owned library. Replacing the standard source alone would still leave their overlapping names in the Compendium; the source-aware review remains necessary.

### Compatibility finding

Of the current 334 standard names, **315** have an exact normalized name in the resolved MM source; **19** do not have an exact name anywhere in the expanded built-in catalog.

Those 19 are:

- Succubus/Incubus
- Vampire, Vampire Form; Vampire, Bat Form; Vampire, Mist Form
- Werebear, Bear Form; Werebear, Human Form; Werebear, Hybrid Form
- Wereboar, Boar Form; Wereboar, Human Form; Wereboar, Hybrid Form
- Wererat, Human Form; Wererat, Hybrid Form; Wererat, Rat Form
- Weretiger, Human Form; Weretiger, Hybrid Form; Weretiger, Tiger Form
- Werewolf, Human Form; Werewolf, Hybrid Form; Werewolf, Wolf Form

MM contains Succubus, Incubus, Vampire, and the corresponding lycanthrope entries with shapechanger rules. This is a representation difference, not evidence that 5etools lacks these creatures.

A migration must map old IDs to the correct source-qualified creature and, where relevant, preserve form-specific context or a compatibility view. Succubus/Incubus is a combined legacy entry and should not silently choose one replacement.

The 315 exact matches are candidate mappings, not proof of identical statistics or rule text. The newer XMM source has only 277 exact matches to standard names and includes edition changes.

## Recommended replacement design

1. **Choose permitted source scope.** Decide which edition/source definitions may be served to the site's users. Keep this explicit in the catalog manifest.
2. **Stage a pinned snapshot.** Retain source commit/release, source IDs, per-file hashes, acquisition date, converter version, counts, and conversion warnings. Store full data on the server or in controlled object storage; send the frontend a compact searchable index.
3. **Build a source-qualified monster provider.** Give each creature a stable identity incorporating its provider, source/edition, and source identity. Retain reprints and variants as separate entries. Offer a preferred-edition display filter without merging definitions.
4. **Validate before selection.** Resolve inheritance, generated versions, legendary groups, tags, and referenced spells. Compare coverage and representative rendered statblocks against the source. Keep missing, ambiguous, and failed lookups distinct.
5. **Preserve old routes and references.** Add an explicit crosswalk for the 334 old standard indices, especially the 19 form/combined entries. Do not turn an old `/api/2014/monsters/...` reference silently into a newer-edition definition.
6. **Review account overlaps.** Keep private packs intact. Offer duplicate/version visibility controls; any cleanup of owned imports is a separate reviewed operation.
7. **Switch the default provider after validation.** Select the staged catalog through configuration, with rollback to the previous source. Keep an archival compatibility layer for old IDs. Retirement of the old default does not require destructive deletion.

This approach can make the richer catalog the normal monster library while avoiding partial imports, broken references, accidental edition changes, and dependence on live third-party requests for each statblock.

## Content rights affect the selectable scope

The mirror's [MIT license](https://github.com/5etools-mirror-3/5etools-src/blob/main/LICENSE.md) is a software license. It should not be treated as proof that all included publishers' game text or artwork may be republished.

The [5etools homepage](https://5e.tools/index.html) describes its intended use as a reference for products users already own. Wizards' [official SRD guidance](https://www.dndbeyond.com/srd) identifies SRD 5.1 and 5.2 content as CC-BY-4.0 and explicitly notes exclusions such as the Beholder.

Therefore, access to a JSON URL is not a blanket redistribution grant. For a publicly served catalog, use verified SRD/licensed material and its required attribution, or separately establish permission for additional sources. Source-level and per-entry SRD flags can assist selection, but a flagged record still needs checking for added non-SRD fields, prose, references, and images.

A modern SRD 5.2.1 catalog is a supported way to gain newer statblock presentation while retaining a clear published license; it does not contain the entire 5etools bestiary.

## Decision

Technically feasible: **yes**. The direct indexed JSON and pinned source mirror are the appropriate inputs.

Recommended: **replace the standard monster provider through a staged, source-qualified snapshot**, after extending the reader/import path and validating content scope and legacy mappings. A purge would not solve schema loss, duplicate versions, or broken references.

Research is complete. No importer, source switch, deletion, or restart was performed.

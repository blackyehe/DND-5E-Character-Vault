# Compendium browse performance

Prepared against combined source `ecb5a04`, preserving the pin-save recovery, notebook syntax successor, Party, reader, Maps, item import and export compatibility. Root is not a deployment source. No original pack, character, room or personal-edition documents are rewritten.

## Behaviour

- Every category starts with 25 results, with Previous/Next navigation. There is no search gate or accumulating Show more list.
- Search and filters run on the server across the full category. Monster families and named item groups are paginated as units; all matching source versions stay in the version selector. Individual versions are filtered before grouping.
- Category facets and additional item tags come from the complete category, even when a query returns one entry. Existing SRD, imported, Workshop and optional personal-edition entries are included.
- Full descriptions, statblocks, lore, artwork and reader data load through an authenticated detail endpoint when selected. The selected detail and its version selector remain available when paging.
- Search waits 250 ms after typing. Changes cancel obsolete requests. Recent metadata pages are cached for 30 seconds, at most 40 pages/4 MiB estimated serialized strings per mounted browser. A new server revision or account change clears cached pages. Returning from Homebrew Files forces fresh metadata. A failed query shows a retry rather than stale matches.

## Persistent index

`/api/compendium-browse/:kind` checks small account-scoped source revision records (`orcbrew`, `item`, optional `compendium-edit`) and uses a dedicated derived `CompendiumBrowseIndex` collection. Existing endpoints are retained for other consumers.

An absent index is built from the existing library once for that category/revision. Facets/search metadata are derived from full source entries before descriptions and artwork are discarded. The compressed index is stored in 512 KiB chunks, well below MongoDB's per-document size ceiling. Part counts and SHA-256 prevent incomplete/corrupt data from being accepted; both Buffer and lean BSON Binary storage shapes are decoded. Concurrent same-instance builds share work. A source revision change during assembly discards the result and retries, preventing a mixed-generation index from being saved. Users and revisions have separate keys.

Derived chunks expire after seven days. In-process metadata is bounded to eight category indexes; source libraries retain their existing independent cache policy. Persistence failure is logged and the freshly built result is still usable. Bump `INDEX_VERSION` when source snapshots or projection/search/filter semantics change.

**Limits:** the first build after an import/edit, a missing index or expiry still assembles the source library. Subsequent function cold starts can read the saved compact index rather than the 90 MB corpus. Lazy imported detail lookup currently retains the existing library assembly path, so a first detail request in a fresh function can still incur that cost. Recent client pages can reflect their prior revision for up to 30 seconds. Local CPU timings below exclude MongoDB/network/function startup and are not claims about live wall-clock latency.

## Local corpus measurements

Used the already backed-up `output/item-source-packs/Post-items homebrew.orcbrew`, 90,064,161 bytes, containing the canonical final 126 raw maps. No new aggregate production download was made. Imported counts remain 5,622 monsters / 5,438 magic items / 1,165 mundane items. The fixture uses the production allowlist for old item index bytes and adds the same local SRD references as the browser.

| Category | Previous imported list | First 25-group page, with facets | Payload reduction |
| --- | ---: | ---: | ---: |
| Monsters | 4,896,458 B | 36,295 B | 99.3% |
| Magic items | 3,521,534 B | 30,455 B | 99.1% |
| Mundane items | 703,697 B | 19,886 B | 97.2% |
| Spells | 901,101 B | 8,922 B | 99.0% |

The new page includes SRD plus imported matches and facets, whereas the prior figure is only the imported response (the old browser additionally requested SRD). Monster index gzip is 814,483 B; magic item index 447,116 B; mundane item index 94,600 B. A representative local run decoded and queried monsters in about 90 ms total, magic items in about 30 ms, and mundane items in under 10 ms. Full corpus parse/catalog creation was about 2.5 seconds locally; the production cold path additionally includes pack reads/library assembly. Exact run evidence is `output/compendium-performance/profile.json`.

## Verification and release handoff

Targeted checks cover far-page search, 25-result bounds across categories, clamped/empty pages, family/source version boundaries, full-category facets/tags, form plus extra damage filtering, persistent multichunk/BSON roundtrip/corruption rejection, module-cold reuse without pack assembly, account isolation, deletion invalidation, concurrent import/rebuild races, personal-edition facet derivation, request cancellation/recent cache/revision resets, authentication and HTTP validation. Fifteen focused assertions/tests plus one local-corpus profile test passed (16 total).

Root frontend build/typecheck passed. Frontend build and server typecheck also pass separately on a read-only export of combined `ecb5a04`, with its existing dependency set. Browser review uses the combined-baseline View, not root's unrelated pending editor implementation. Actual Vue review at 1440/720/390/320 CSS pixels covers both palettes/reduced motion, bounded rows, cached Previous, detail persistence on Next, far-page Wish search, Aboleth's three versions, Flame Tongue form/damage/rarity/attunement filters, failed search and retry. No horizontal overflow or runtime exceptions. Screenshots and local request fixtures: `.preview.local/compendium-performance/`.

Handoff: `output/compendium-performance/performance.patch` plus SHA-256 manifest in the same directory. Final v2 patch SHA-256 is `a1d110fee48f833ef4483534470d0a3351680ca16a808ebaf583a66455da31b4`; v2 retains the previous skip of SRD level lookups for imported class/subclass IDs. Only three existing app files change (route mount, Compendium View and its layout CSS), plus six new app modules and five companion test files. Preserve `ecb5a04` or its verified successor and all intervening work. Never publish root.

## Production verification

Ready/promoted deployment `dpl_EeZAqQqzPGEtTUm8hsk2XKHWVY19`, source `65a8b8c`, serves https://dndoldal.vercel.app. The release coordinator audited all 325 hosted inputs and preserved the live notebook-tag successor, pin-save recovery and other combined features. Compatible rollback: `dpl_3EovXWbvhGQbTYqqHsu9zLtzmP7p`. Root publication remains held.

Authenticated read-only QA on 2026-10-23 passed. Imported matches are exactly **5,622 monsters / 5,438 magic items / 1,165 mundane items**. Including other library origins, the live account has 5,956 monster source entries / 3,833 groups, 5,801 magic item entries / 4,474 groups (one account Workshop addition versus the local fixture), 1,402 equipment entries, and 635 spells.

Observed browser wall-clock measurements, including network/body read: first spells/index request **12,343 ms / 9,139 B**; monster first page **3,741 ms / 37,872 B**; monster page 2 **257 ms / 41,129 B**; magic first page **867 ms / 32,406 B**. Subsequent imported-count/search requests measured **59–312 ms**, including Aboleth 59 ms, Wish 61 ms and Flame Tongue Longsword 312 ms with Longsword/fire/rare/required-attunement/DMG filters. These are individual observations, not latency guarantees. Source option sets remained complete (118 monster / 74 magic / 40 equipment / 24 spell options). Source facet values are case-sensitive; DMG is correct, while a manually supplied lowercase dmg correctly returned no matches.

Live UI shows 25 creature groups per page. Aboleth retains its three versions, enriched statblock, artwork and regional-effects controls on Next. Returning with Previous within the 30-second page-cache window made **zero additional browse requests**. Wish search and full spell rendering passed. The live 1280px viewport had no horizontal overflow or captured runtime errors. The preview resize setting did not change its actual viewport; desktop/mobile breakpoint coverage therefore remains the independently completed local browser review, not a claimed live mobile check.

Full imported Aboleth detail returned 200 in **12,305 ms / 27,626 B**; the following Flame Tongue Longsword detail returned 200 in **92 ms / 5,298 B**, preserving item rules/artwork. This confirms the documented first imported detail/library-assembly limitation remains. No forced fresh function instance or persistent-cache reuse was induced live; persisted cold-module reuse is covered by local verification. No giant export, original saved-content writes, imports or further deployments occurred during QA; GETs may populate disposable derived indexes. Evidence: `output/compendium-performance/live-qa.json`.

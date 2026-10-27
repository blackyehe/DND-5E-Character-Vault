# A 5etools-inspired Compendium: what we can actually reuse

23 October 2026. Exploration and offline measurements only. No app patch, production request, data migration, deployment, cache deletion or restart.

**Sir, we can borrow the useful design without replacing your website with 5etools. The recommended first change is to make the Compendium a reader of prepared data, rather than sometimes making it prepare the library as you open it. Browser-side search can follow if it proves worthwhile.**

**What fits from 5etools**

- Prepare the search catalogue before it is needed. Their build script writes search files in advance. We need an equivalent for an account's changing imports, not a single public file for everyone. [Generator](https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/node/generate-search-index.js).
- Divide data into manageable parts. Their monster page loads selected source books and filters already-loaded entries locally. For us, separate category catalogues are a good first boundary: search Monsters without downloading Items or Classes. Book-sized pieces are an option later. Whole-library search must still cover every enabled source, including books whose full rules have not been downloaded. [Monster/source loader](https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/js/multisource.js).
- Reuse unchanged data using version fingerprints. Their service worker keeps revision-aware cached files. Our private account data needs its own account/version checks; their public-file caching rules cannot simply be applied to every API response. [Caching implementation](https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/sw-template.js).
- Search locally after loading a catalogue. Their global search builds a browser search engine from a prepared directory. We already have browser-compatible name, source, filter and version-grouping functions. [Global search](https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/js/omnisearch/omnisearch-backing.js).

**What we should copy directly, and what we should adapt**

Their code is published under MIT, with a requirement to retain the notice when copying code or substantial portions. No upstream code has been copied into our app in this exploration. The software licence is not a separate grant for the rulebooks themselves. [Software licence](https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/LICENSE.md).

The complete 5etools list UI is not a drop-in Vue component. It depends on site utilities, DOM wrappers, sorting helpers and optional search libraries. The global search additionally expects their Parser, Renderer and homebrew helpers. Importing all of that would add integration work and change our current search behaviour. Our existing shared code is a better fit for preserving the filters and monster version choices you already approved. [List implementation](https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/js/list2.js).

Small, isolated utilities could be adapted later with attribution if a measured need justifies them. There is no demonstrated need to bring in their whole renderer, search engine or service worker to solve today's initial-load issue.

**What the local measurements say**

The retained 126-pack fixture contains the imported collection plus standard reference entries. It is historical local data, not a new snapshot of your current account. Existing baseline search/filter functions were run unchanged, without starting a server or contacting a database.

- Monsters: 5,956 records representing 3,833 families; catalogue 5,170,820 bytes before compression and 814,483 bytes with gzip. Typical full-list grouping/filtering: 48.5 ms on this computer; an Aboleth search: 0.77 ms.
- Magic items: 5,800 records representing 4,474 groups; catalogue 4,490,733 bytes before compression and 447,116 bytes with gzip. Typical first-page computation: 4.36 ms; the combined Flame Tongue + DMG + longsword + fire + rare + attuned query: 0.25 ms and one matching version.
- Spells: 635 records; catalogue 317,625 bytes before compression and 32,753 bytes with gzip. Typical first-page computation: 0.13 ms.
- All 15 category catalogues combined: 1,474,482 gzip bytes. A DM would not need to download all of them to open one category.

These timings are local Node CPU medians across 15 calls per query, not browser rendering times or website loading promises. Large monster grouping is enough work to justify investigating a background browser worker before putting it on a phone's main UI thread. Downloading and JSON decoding are separate costs.

The existing 25-row responses are smaller: about 8,457 gzip bytes for Monsters and 5,094 for Magic Items in this fixture. Switching to a whole-category download therefore increases a fresh visit's transfer. For scale, 814,483 bytes takes about 1.63 seconds at 4 Mbps or 0.33 seconds at 20 Mbps for the bytes alone. These are arithmetic examples, excluding authentication, latency, server time, processing and contention. They are not expected total load times.

We also measured existing imported entry details separately. The fixture has 13,709 active imported detail records, totalling 29,770,344 bytes when each is independently gzipped. The median detail is 1,839 gzip bytes; the largest is 27,892. MM Aboleth is 5,724 gzip bytes. This supports retrieving one prepared statblock at a time rather than parsing its whole source book. These are derived active records, not a replacement for original packs or a claim about every disabled definition.

**The recommended design, in plain language**

1. Keep the original Orcbrew files exactly as they are. They remain the originals for export, recovery and verification.
2. Give the Compendium a separately saved, ready-to-read catalogue and separately readable entry details. These are derived copies, not new sources of truth.
3. Tie each prepared piece to the exact source fingerprint and parser version. If one book changes, reuse the unchanged books. Keep account-specific enabled/disabled choices and personal edits separate so an edit does not require reparsing unrelated rulebooks.
4. Open the Compendium by reading prepared data. Opening an individual entry reads that entry. Searching must never need to load raw books merely to discover their names or filters.
5. Optionally keep a bounded browser copy of a category and search it locally. Validate account/access/version before using it, fetch only changed pieces and stop obsolete requests. If storage is unavailable, browsing still works through the server.

Being a DM tool makes a dedicated browsing experience appropriate. It does not require removing access checks: the current browse routes authenticate users and scope queries to their account. This exploration does not add, remove or infer a new server-side DM role rule.

**How to avoid moving the wait somewhere else**

The first implementation should address prepared-data availability independently of browser caching. Retain small server-paged responses while that is reviewed. This targets rebuild delays without making every first visitor download a larger category.

For existing packs, a separately approved, resumable preparation job could create derived records from backed-up, hash-checked originals. It would process bounded units, verify them and publish a completed revision atomically. Nothing is migrated during this exploration.

Future imports and edits need a durable preparation mechanism. Adding extra work directly to the save request could lengthen saves. Launching an untracked promise after returning a response is not reliable on a serverless function. A persistent job/status mechanism, or a measured bounded update for small changes, must be chosen explicitly. CPU, storage and operational work remain real costs.

Changes must appear accurately even while preparation is pending. A proposed implementation must either handle current small edits as an immediate overlay, use an explicit current-data fallback, or show that preparation is pending. It must not silently serve an old revision as the new rules. Concurrent edits/imports must not publish a mixed catalogue. Pack removal must stop deleted entries appearing even if derived files still exist.

**A reviewable implementation sequence**

1. Establish which measured delays come from missing catalogue preparation, database/authentication or detail parsing. Existing performance evidence does not isolate every initial-load complaint.
2. Prototype durable prepared category/detail reads locally. Compare search results, family/version choices, filters, provenance and exact rule payloads with baseline. Preserve source fingerprints, account boundaries and personal edits.
3. Measure write/import cost and failure recovery. Verify that preparation completes without keeping an interactive save request waiting. Agree on the one-time existing-pack preparation separately from application release.
4. Compare two local browsing modes on desktop and mobile: existing small server pages versus one cached category searched in a worker. Measure first visit, repeat visit, edits, source toggles, failed storage and slow network. Do not assume that fewer requests automatically makes the first load faster.
5. Send a narrow frozen app delta and evidence to the combined release coordinator. Any hosted trial or publication needs the release boundary agreed separately. Keep root publishing held and preserve the paused backend/static-prefetch experiments as separate work.

**Scope and evidence**

Production app baseline: committed `8010a11` / live app `065066d`. The combined worktree's held `server/lib/compendium-browse.ts` diff was excluded. The offline runner checked the unchanged shared query implementation; no existing app file was edited. No automated test suite was added or run.

Files: `profile-catalogue.ts`, `run-profile.mjs`, `catalogue-profile.json`. Input: `.preview.local/compendium-performance/indexes.json`, SHA256 `1e7e25d643f7cd0140d5ac4e017e3344c82a12e026ede9d8f222bf5c78f675c1`; details came from its matching retained `details.json`. Four imported implementation files were checked byte-for-byte against committed baseline: `shared/compendium-browse.ts`, `shared/monster-identity.ts`, `shared/compendium-facets.ts` and `src/lib/magic-item-filters.ts`.

The first attempt to run the measurement through tsx failed before profiling with `uv_os_get_passwd returned ENOMEM`. The successful runner uses local TypeScript transpilation and Node module hooks instead; this is a local sandbox/tool issue, not a Compendium memory finding. The reported 710 MiB profiler RSS includes parsing the whole 116 MB historical detail fixture and TypeScript tooling; it is not a predicted browser footprint.

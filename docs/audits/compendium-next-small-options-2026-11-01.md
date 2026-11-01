# Small remaining Compendium loading options - 1 November 2026

Scope: code inspection and reuse of existing traces, without new performance experiments or backend changes. These are candidates, not measured additional savings. Compare any implementation with the current live automatic-preparation release, not the older full-library rebuild.

The selected entry's opening and the category search list are separate paths. Search indexes already prepare automatically on the device; complete opened entries already have bounded memory/IndexedDB caching with owner and revision validation. Imported packs now have automatic server preparation. None of those should be presented as a new proposal.

| Priority | Candidate | Where it helps | Effort and limits |
| --- | --- | --- | --- |
| 1 | Request a larger bounded batch of library metadata | Fresh validation when the owner's metadata crosses the default first cursor batch | Small. `browseRevision` selects small metadata but does not set `batchSize`. Prior 126-pack traces include `getMore` after metadata reads. A bounded batch could remove these extra exchanges without removing either before/after consistency check. Measure one focused trace; do not promise seconds. |
| 2 | Combine legacy/current source-cache lookups | An imported detail needs the server and the legacy cache misses | Small. `importedCompendiumSource` currently awaits the compatibility lookup before the current-version lookup. One owner/revision/kind/index query can retrieve at most both candidates using the existing unique compound index; preserve legacy preference and digest validation. It saves an avoidable query when applicable, not rendering time. |
| 3 | Load the hovered or keyboard-focused entry before selection | A first opening after the user rests on a result | Moderate. Result buttons currently only load on click. Use a short intent delay, one pending request, strict request/size limits and existing owner/revision checks. Join a click to its pending request; yield to real foreground work. Merely moving the current foreground loader to a hover handler would cancel maintenance and can duplicate requests. This hides some waiting but generates unused reads when selection changes. |

Recommendation under the remaining usage budget: choose metadata batching first, with one narrow same-data request-count test. Keep the second candidate as the next small server cleanup. Hover/focus loading is a useful later UX option, with a clear cap on extra traffic.

Broader per-category invalidation may preserve more cached entries after unrelated edits, but changes freshness semantics and is not a small batch. A renderer rewrite, database replacement, or bulk download of every full entry is not justified by current evidence. Previous real-browser observations placed substantial entry rendering in milliseconds and most waiting before headers; those historical samples are not a current speed guarantee.

References in this repository: `src/lib/compendium-detail-cache.ts`, `src/lib/compendium-detail-storage.ts`, `src/views/CompendiumView.vue`, `server/lib/compendium-browse.ts`, `server/lib/compendium-details.ts`, `server/lib/compendium-entry-source.ts`, `server/models/CompendiumEntryCache.ts`, and [previous measurements](loading-investigation-2026-10-31.md).

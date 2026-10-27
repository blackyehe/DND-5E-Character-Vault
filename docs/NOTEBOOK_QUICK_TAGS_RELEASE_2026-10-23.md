# Notebook quick tags — 23 October 2026

Campaign Codex entries now expose Add tags / Edit tags directly in the reader. A focused inline picker supports searching existing tags, clicking choices, removing selected tags and typing a new tag with Enter or Create & add. Explicit Save tags / Cancel tags stay visible while scrolling. The full entry editor uses the same picker.

Filter by tags replaces the former Show for panel in the library sidebar. Searchable checkboxes show usage counts; selected chips and Clear make recovery straightforward. Multiple selected tags match every selected tag within the current category/search. Clicking a reader tag searches all categories. The former relevance control remains under an optional Character filter, explaining that it does not change entry sharing.

## Data protection

A dedicated DM-only PATCH /api/rooms/:roomId/notebook/entries/:entryId/tags accepts only expectedRevision and tags. Existing membership, room, preview and active-entry guards apply. An atomic revision check updates tags and revision metadata and records history, without overwriting descriptions, audience, clues or relationships. Failed saves retain the draft. Load latest tags preserves concurrent changes and reapplies only local additions/removals; another explicit save is required. Tag drafts participate in existing unsaved-navigation safeguards. The existing 20-tag limit is retained without silently truncating conflict merges.

## Verification

- 35 focused tests pass in shared/notebook-tags.test.ts and server/routes/notebook.test.ts. Archived .preview.local snapshots were excluded from test discovery.
- Frontend typecheck/build and isolated production server typecheck pass.
- 16 browser scenarios pass against development and the final compiled frontend: direct assignment, existing/new tags, narrow save payload, filters/search/clear/empty results, duplicate prevention, discard cancellation, Escape/focus restoration, simultaneous edits, failed save retry, desktop/tablet/phone layouts, long tags/limits, full editor syntax preview, player preview, touch and reduced motion. No uncaught browser errors.
- Browser interactions use intercepted synthetic data; no real campaign entries are edited for verification. Native browser snapshots timed out twice, so the documented isolated Edge fallback was used.

## Release boundary

Baseline / rollback target: dpl_8McziMm9wyZhpA7PV3XdA5mwFyCm.

Exactly six production files change: shared/notebook-tags.ts; src/components/notebook/NotebookTagsEditor.vue; src/components/notebook/NotebookTagFilter.vue; src/components/notebook/CampaignNotebook.vue; src/components/notebook/notebook-tags.css; server/routes/notebook.ts. All 319 source inputs are checked against reconstructed current-production hashes plus this delta. Existing Maps, notebook syntax, feat panels and navigation recovery remain included. Unrelated checkout edits and test files are excluded from deployment.

Release metadata and screenshots: .preview.local/notebook-quick-tags-20261023/ (local only). No commit or PR is created.

Live release: dpl_3EovXWbvhGQbTYqqHsu9zLtzmP7p, promoted to https://dndoldal.vercel.app after verifying staged readiness, all 319 source hashes, API health and the unchanged baseline alias. Public verification confirms the promoted alias, healthy API (200), served quick-tag/filtering and retained syntax bundles, existing feat/navigation fixes, protected endpoints (401), and desktop/mobile login redirects without runtime errors. Production verification performs no campaign writes.

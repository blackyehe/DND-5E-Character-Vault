# Notebook Gallery preview — 23 October 2026

Place entries now offer Overview, Gallery, Encounters and Connections. Gallery shows artwork for the place, with optional titles and captions and an enlarged viewer. It uses the existing notebook visual style and whole-entry visibility: readers can view, while existing notebook editing permissions control artwork changes.

The editor supports uploading, reordering and removing up to six JPG, PNG or WebP images. Each input may be up to 10 MB. Images are resized locally to at most 1800 × 1800 and encoded as JPEG with a maximum 200,000-character data URL per image. Existing header artwork appears when the separate gallery is empty. Native dialogs support Previous/Next, arrow keys, Escape and focus return. Controls fit a 320px viewport.

Artwork is stored on the entry and omitted from index/autocomplete results and text history snapshots. Restoring a text version preserves current artwork. Older clients omitting the gallery field also preserve it. Server validation restricts artwork to places, validates bounded raster data and unique artwork IDs, and enforces existing permissions and revision conflict checks. Access-checked `knownRevision` polling avoids transferring artwork when nothing changed. The latest-version conflict panel includes the saved Gallery.

## Isolated candidate

- Evidence and scripts: `.preview.local/notebook-gallery-20261023/`.
- Source: `.preview.local/notebook-gallery-20261023/source/`.
- Baseline: production `dpl_EmvAJ4VcZUCYob7vbfqFRG3yJfjM` (Compendium builders release).
- Inputs: all 343 baseline inputs reconstructed; 338 preserved, five changed and four added, yielding 347 audited deployment inputs.
- Preview: `dpl_6FvQ7owySjzu61Uu41DdyavGqhME`, https://dndoldal-jakjke6bg-dndenjoyerstudio.vercel.app.
- Seven-day review access is recorded privately in `preview-link.local.json`. The hosted preview requires normal application login and uses real account data.
- Sample-only local preview: http://localhost:5203/rooms/000000000000000000000ca1?section=notebook. Places → Lantern Harbor → Gallery. Its writes remain in memory.
- Nine implementation files and two test files synchronized to the shared workspace with baseline comparison and backups; no conflicting root changes overwritten.

## Validation

- 62 tests across nine notebook files passed, including gallery persistence, access, index privacy, malformed data, conflicts, category constraints, old-client saves, restoration and revision polling after access revocation.
- Candidate frontend typecheck/production build and isolated server typecheck passed. Shared-root frontend and server typechecks also exited successfully.
- Fourteen compiled local browser checks passed: uploads, resize limits, titles/captions, reordering, save/remove, viewer controls and focus, rejected SVGs, draft cancellation, player visibility, DM-only exclusion, 320px layouts and header fallback. No uncaught runtime errors. Sample data only.
- Hosted health returned 200. Unauthenticated notebook list/detail reads and PATCH returned 401. Compiled Gallery code was verified. Desktop/mobile login rendered without overflow or runtime errors. No production data writes were performed during verification.
- Full hosted source hash audit passed at 15:45 UTC, including confirmation that the main alias still targeted the baseline. A later alias API recheck returned 403; the public site remained accessible. The local build's asset name cannot be used to infer a hosted deployment change. Recheck the current live source before any future production promotion and preserve any later releases.

This is a staged preview only. No production promotion was issued for Gallery.

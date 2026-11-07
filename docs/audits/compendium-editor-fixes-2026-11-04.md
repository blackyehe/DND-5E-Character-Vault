# Compendium preview frame and class spell picker — 4 November 2026

Published as `dpl_6zGTR3pdJzLQ76dKXF2XG7iUwzoB` on both website aliases. Immutable address: `https://dndoldal-iuzn8oqai-dndenjoyerstudio.vercel.app`. This release addresses the reported visual clipping and class spell-list discovery. Backend startup optimization remains paused; the unpublished backend data-loading experiment is not included.

## Fixed preview frame

The Compendium's rule preview had two nested scrolling containers: the outer builder preview and the inner Workshop preview. Its bordered panel extended below the outer viewport, so the bottom border appeared only at the end of the content.

The class/race/subclass preview now keeps its frame around one internally scrolling panel. The bottom border and rounded corners remain visible at every scroll position. On narrower layouts the preview expands naturally within the editor's main scrolling area. Monster preview scrolling and the standalone Workshop preview layout are unchanged.

The previous production browser bundle reproduces the clipped bottom with both nested containers reporting `overflow:auto`. The final built candidate verifies the visible border and single preview scroller at top, middle and bottom positions, including 1440- and 1024-pixel layouts. The 390-pixel layout uses the main dialog scroll without an extra preview scroller. Screenshots were inspected locally.

## Class spell-list improvements

The old picker concatenated SRD spells before imported spells and displayed only the first 60 matches, without pagination. This made imported definitions difficult to reach even when they had loaded. Separate legacy class/spell requests could also leave only the standard results available after a partial loading failure.

The shared class/subclass picker now provides:

- The existing Compendium filters for library, source, level, school, spell list, casting time, concentration and ritual.
- Ordering by level then name, name, or source then name, reusing the existing spell-level grouping behavior. Missing levels stay distinct from cantrips.
- All/selected/unselected views and pages of 40 versions, with every matching version reachable.
- Independent selection of same-name source versions. Search, filters, sorting and pagination do not change selections or mark an entry edited.
- Preservation and explicit repair of unresolved original references; replacing one with an already selected definition deduplicates the reference.

The Compendium editor loads imported classes and spells through one existing prepared Workshop authoring request with a 60-second timeout. It loads standard spell metadata through the existing Compendium index so the normal filters have their required fields. Partial failures remain visible, retain the saved selections and offer retry. No new backend endpoint or schema is introduced. The standalone Workshop uses the same improved spell picker and standard metadata.

## Verification and release boundary

All 302 frozen application tests pass, with the same two optional external-pack tests skipped. Five new discovery tests cover imported entries beyond the former cutoff, combined filters, missing levels, independent source versions, selected/unselected views and preservation of input data. Frontend/backend types and the Vite production build pass.

The actual built application passes synthetic editor checks at 1440, 1024 and 390 pixels. All 97 fixture spell versions are reachable. Checks exercise source/level/school filtering, ordering, selected-only view, no-match recovery, original-reference replacement and a synthetic save whose payload retains the expected selected references and source identity. A separate failed-import/retry case preserves the original selections and recovers imported choices. Browser errors are absent. Early harness/control-label failures and their corrected attempts remain archived rather than counted as passing checks.

On both the staged and public sites, separate fresh desktop/mobile browser contexts open the reported class's real editor, verify imported-source spell choices, ordering and selection filtering, check the preview frame and close without saving. Filter-only interactions leave Save changes disabled. Before/after class definitions match exactly, and no mutation request is sent. Read-only acceptance also matches the prior release across characters, room identity, Creator, Notebook, sessions, links, Workshop and Maps. Login/protected redirects, route recovery, Dashboard and Compendium browsing/detail checks pass. Browser contexts are closed; the user's open Owlbear room is untouched.

The release is built from the exact archived production package `dpl_Kos3t4SFmhPRmNNfVAFFPcXVyBTh`, with six frontend runtime files and one new test changed or added. All 494 hosted source inputs match the frozen manifest. The dirty root checkout was not deployed; its unrelated files are verified unchanged. Server runtime, hosting configuration, Frankfurt region and environment-variable names are unchanged. Both Owlbear aliases remain on `dpl_6yPZh1hytcg8a2XNzSHnRpZjpz8W`. No campaign, character, library or source definition was changed in production. No Git commit, push or PR was made.

Rollback: `node .local/compendium-editor-fixes-20261104/release.mjs rollback`, while this release owns the public alias. The helper verifies ownership before promoting the preceding compatible release. No database work is required.

Ignored evidence is under `.local/compendium-editor-fixes-20261104/`: original root fingerprint/target copies, exact frozen source and manifest, validation logs, old-layout reproduction, desktop/mobile editor and retry checks, inspected screenshots, hosted source and acceptance records, promotion, public checks and final gates. Credentials and full private source content are not included in this report.

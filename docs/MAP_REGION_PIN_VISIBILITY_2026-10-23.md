# Map region pin visibility

User clarified that selecting one region should keep other regions' pins available. Saved per-pin zoom settings remain in force. This is a presentation change to MapCanvas.vue only; it does not change map, note, player access or saved campaign data.

Removed the active-region polygon inclusion filter and the extra region-focus zoom threshold from shownPins. Region selection still focuses the camera. Pins remain at their original map coordinates; panning can bring locations outside the current viewport into view. Existing saved zoom visibility, DM Show all, draft/drag visibility and border editing behavior remain unchanged. Region atlas counts still describe locations inside each region.

Narrow patch: `.preview.local/map-all-regions/all-regions.patch`, SHA-256 `2b95ae62453b10d3b6f7a2873c3a7dd9ef75c51595475cf37b4d9beccd25068f`. Baseline raw file SHA-256 `055eeed6e58ab831ee9c084612957c733e30fe087d97e515d58fa302c525befb`; patched LF file SHA-256 `9e2b62fc4a4c95120264ce90fa89d1b854852dc739b5aba8a97fe6703f1652ea`. git apply --check passes against the combined worktree.

Manual local browser review of the actual patched Vue component used four disjoint regions, one always-visible location per region, an outside-all-regions location and a close-zoom location. Every region selection preserved all five always-visible locations in player view. A location from another region opened successfully. The close-zoom location stayed hidden at 211% and was revealed by DM Show all. No captured runtime errors or horizontal overflow. Fixture/review evidence lives in `.preview.local/map-all-regions/`. No tests added/run; combined build/release verification is owned by the existing release coordinator.

Handed the narrow patch to Interactive Map Thread for integration alongside its notebook changes, preserving builder successor dpl_EmvAJ4VcZUCYob7vbfqFRG3yJfjM and later verified combined source. Not deployed at handoff. Root publishing remains held. No shared-worktree edits, saved-content writes or T3 restart.

## Final production QA

Ready/promoted combined source `96fc81a`, deployment `dpl_3tCHmSEjjG7gKggHSGbDHVQMKw2S`, at https://dndoldal.vercel.app includes Gallery, notebook tag/visibility controls and this exact MapCanvas fix. Coordinator verified all 348 hosted source inputs and passed build/server typecheck plus independent desktop/mobile integration review.

Authenticated read-only QA opened the existing Continent of Revalon map (four regions, nine pins). Each region's selected state was confirmed. With temporary Show all enabled, all nine pins remained non-inert and nontransparent for every region. With Show all disabled, all nine remained available in every region at 1000% zoom. All nine existing pins have the saved Close visibility setting: zero were visible at 189%, confirming that saved zoom behavior remains in force. Region selection focused at 128–190% in the narrow preview. These assertions exclude inert/transparent transition-leave elements, rather than counting DOM nodes alone.

The collaborative preview stalled animation frames, so QA temporarily set the page's DOM motion mode to reduced; the prior DOM value was restored afterward and the map popup closed. No preference API or saved data was changed. Actual QA viewport was 297 CSS pixels despite the requested resize; no page overflow or captured runtime errors. Motion/desktop/mobile integration coverage remains the coordinator's independent local review. Evidence: `.preview.local/map-all-regions/live-review.json`. No writes/imports/exports/deployments were performed during this QA. Root publishing remains held; future publishing must preserve `96fc81a` or its verified combined successor.

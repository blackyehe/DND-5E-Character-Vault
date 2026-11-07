# Focused Compendium reading and duplicate-rule presentation — 4 November 2026

Published as `dpl_Cxshh3QWN4V7RchbSYJWXH7t9pzR` on both website aliases. Immutable address: `https://dndoldal-n8ziyuv4c-dndenjoyerstudio.vercel.app`. This is a frontend reader correction; source definitions, character rules and campaign data are preserved.

## Confirmed cause

The reported Revenant Shadow entry retains its original imported `details` alongside its published `workshop` definition and authored `benefits`. This is the existing storage model, which preserves source material for comparison/restoration. The reader independently rendered the original `:spellcasting` and a second “Published spellcasting” section. Its fallback also printed the original `:level-modifiers` alongside the authored benefits. The flat published spell list contains saved references, including opaque imported spell IDs, which the generic string-list renderer displayed verbatim.

The issue was confirmed by reading the actual published entry and inspecting field names and list sizes. No assumption about corrupt or accidentally duplicated source records was needed, and no data cleanup was performed.

## Shared reader correction

The shared presentation now uses the published magic definition when it explicitly specifies enabled/disabled casting. Known original casting fields are replaced by that current definition; unique source notes and explanatory information remain readable. It displays a single spellcasting section and casting-ability fact. Imported-only entries retain their original rules.

Authored benefits follow the same explicit replacement behavior as the existing game-rule `entryBenefits` helper, including an intentionally empty list. Original modifier/resistance grants are not resurrected beside that replacement. Unrelated source properties and choices remain available. Authored benefits use the same level/benefit table and spell-level/casting-ability detail layout as imported benefits. An acquisition level is not inferred from a spell's own level.

Known editor payloads and search metadata are excluded from the generic reader rather than printed as extra rule sections. These changes apply through shared readers across the categories where those shapes occur; they do not rewrite entries or alter game calculations.

Spell lists and grants resolve readable names, source and available level metadata through the existing authenticated spell-category metadata export. The owner, format, payload digest and index structure are checked. Only unambiguous aliases are accepted. The name map lives in that reader instance; pending work is cancelled on unmount. Missing/unavailable definitions keep an inspectable original reference, and failed name loading offers retry. No name is guessed from a hash, no new backend endpoint is introduced, and no persistent name cache is added.

All reader sections, including Choices by level, Subclass help and Benefits, now use consistent framed headings, padding, borders and table spacing. The spell list is a readable list of definitions instead of a comma-separated ID block.

## Focused reading

Every selected Compendium entry offers **Focus view**, including spells, items and monsters. It moves the same mounted detail panel into a native modal reader. Opening it does not itself reload the entry or duplicate its reader state. The focused frame provides a fixed close control and one scrolling reading area, with a full-width mobile layout.

Escape and the close control return keyboard focus and the original compact-reader scroll position. Background scrolling is restored. Editing from focus first closes the native reader, then opens the existing editor. Route/category/account changes clear focused reading with the normal selection lifecycle. Notebook/Owlbear behavior is unchanged.

## Verification

- All 324 tests pass, with the same two optional external-pack tests skipped. New cases exercise canonical presentation for every one of the 15 category keys, explicit removals, retained source-only rules, metadata hiding, reference names/aliases, owner/integrity rejection and context-sensitive reference detection.
- Frontend/backend types and the production Vite build pass against the exact frozen source.
- Built-browser synthetic checks open and close focus in all 15 categories at desktop width and the class/spell/monster/item layouts on mobile. They verify the same reader DOM node, no extra detail request from focus, keyboard containment/recovery, body scroll recovery, editing from focus and no horizontal overflow. A separate case checks compact scroll-position restoration and metadata failure/retry. Screenshots of desktop/mobile section styling were inspected.
- The real reported class passes staged and public desktop/mobile checks: one casting section, one benefits section, resolved spell names, consistent section frames, focused reading, Escape recovery and editor opening from focus. Before/after class-definition fingerprints match and no mutation requests are sent.
- Staged/public read-only acceptance matches the preceding release across characters, room identity, Creator, Notebook, sessions, links, Workshop and Maps. Existing login/protected redirects, route recovery, Dashboard and Compendium browse/detail checks also pass without browser exceptions.

The initial browser pass found that conditionally unmounting the focus opener prevented keyboard focus from returning; the final implementation hides and retains that button instead. The corrected candidate was rebuilt and rechecked before staging. Failed attempts remain in the ignored evidence.

## Isolated release

The package derives from the verified preceding release `dpl_6zGTR3pdJzLQ76dKXF2XG7iUwzoB`, not the dirty root checkout. Ten frontend runtime files and two new test files are changed or added. All 499 hosted source inputs match the frozen manifest. Unrelated root files are verified unchanged. Server runtime, hosting configuration, Frankfurt region and environment-variable names are unchanged. Both Owlbear aliases remain on `dpl_6yPZh1hytcg8a2XNzSHnRpZjpz8W`; the user's open room was not controlled.

The promotion request succeeded, but alias propagation exceeded the helper's short confirmation window. A subsequent read confirmed both website aliases on the intended deployment with no alias error; public acceptance then passed. No second promotion was required. No Git commit, push or PR was made.

Rollback: `node .local/compendium-reader-fixes-20261104/release.mjs rollback`, while this release owns the public alias. This promotes the preceding compatible release without database work.

Ignored evidence is under `.local/compendium-reader-fixes-20261104/`: original root/target fingerprints, private read-only source inspection, exact frozen package and manifests, test/type/build logs, browser cases and inspected screenshots, hosted/public checks, promotion confirmation and final gates. Private source contents and credentials are not included in this report.

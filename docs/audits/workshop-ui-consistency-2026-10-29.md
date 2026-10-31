# Workshop UI consistency — 29 October 2026

Release follow-up: **published and publicly verified**. See [the release, hosted checks and rollback target](workshop-ui-release-2026-10-29.md). The original local validation below remains supporting evidence. This pass follows the user's request for a more uniform appearance across Workshop categories while retaining the earlier button-placement requirements.

## Layout

All six top-level categories use the same library-tools component: search at the upper left, contextual New actions at the right where creation is available, and category filters directly below. A common heading, short explanation and Reload library action follow those controls. Categories share the same content width, heading scale, theme colours and card styling. The large rules-only introduction was removed so the actual library stays closer to its controls.

Classes/subclasses/races, character options, items and monsters retain their specialised editors. Device drafts and saved definitions use consistent cards with clear continuation/edit actions. Item delivery remains separate from editing. Recently deleted has a local search and consistent empty state; it does not offer a creation action. The embedded Compendium uses the same surrounding layout, retaining its existing search, filters and reader. Its compact category selector is hidden at desktop widths and retained below the existing breakpoint.

Draft save controls sit together immediately below the Workshop category tabs: Back, Save draft and Save to pack. For character options, Save to pack focuses and reveals the existing destination panel; for monsters it opens the existing review step; class/race rules keep their pack dialog. These shortcuts do not publish immediately. Device/account/pack storage distinctions remain explicit. Reusable items and actions retain their account-library save flows.

The site-backup action now stays in the page header across categories. It flushes the active option or monster draft before reading browser drafts, and retains the existing complete-backup handler. No authoring endpoint, pack schema, grant calculation or cache behaviour was changed.

## Checks

- Production frontend build, including Vue/TypeScript checks, passes.
- Existing entry-builder/option authoring suites: **33 tests pass**.
- Eleven local Edge desktop scenarios use actual Express routes and an isolated loopback MongoDB database. They check the six category layouts, rule draft saving and pack dialog, character-option draft and pack saving, all eight option-type actions, item filtering/editing/saving, monster draft retention through category changes, actual monster pack saving, reusable-action navigation, Compendium search/detail, recovery search, and backup of an in-progress monster draft.
- At 1440px, every category's tools have the same left edge and width. Search and New actions align. All six categories avoid page overflow at 1024px.
- Final browser checks also cover the light appearance and the standalone Compendium. The standalone browser keeps its original heading and has no Workshop toolbar. Its detail-rendering body is unchanged from the pre-task source.
- Final successful workflows report no browser exceptions, console warnings or unexpected API errors. Synthetic content and databases are cleaned up. No production account, pack, character or deployment was modified.

The initial before-layout capture had a fixture-only missing class-list response, corrected in the test server. An early post-change assertion expected an item dialog to remain open after saving; the existing composer correctly closes it, and the assertion was corrected. Those diagnostics do not represent application failures. Visual review also caught and corrected punctuation encoding and the duplicate desktop category selector before the final run.

## Scope and release boundary

Eight frontend files are involved: `HomebrewWorkshopView.vue`, `OptionWorkshop.vue`, `ItemWorkshop.vue`, `MonsterWorkshop.vue`, `WorkshopTrash.vue`, `CompendiumView.vue`, `workshop.css`, and the new `WorkshopLibraryTools.vue`. Existing dirty work was backed up before editing and retained. The earlier imported-item validation candidate remains separate; the live creator release is unchanged.

Ignored evidence is under `.local/workshop-ui-20261029/`: pre-task file copies/design notes, before/after desktop screenshots, build and test logs, final browser results and source hashes. A future release must merge only this UI scope into the audited live package and complete hosted checks; the dirty checkout must not be deployed wholesale.

# Site layout stability

Implemented and deployed on 22 October 2026 with the approved Campaign Codex release. See [production verification and rollback](NOTEBOOK_CODEX_RELEASE_2026-10-22.md). No notebook content or visibility changes. The verification notes below describe the original local checks.

The site already reserved document and reader scrollbar gutters, kept reference data available during character refreshes, restored party-dashboard positions, and protected keyed character switches with `useCharacterSwitchScroll`. Those protections remain in place.

## Changes

- Notebook: the index and reader have a bounded, responsive frame with their own scrolling. Loading, entry length, editing and history no longer resize the surrounding document. On narrow screens the library and reader occupy the same grid slot. Returning to the library keeps its position. Deliberate entry selection resets only the reader; keyboard focus moves to its heading on narrow screens without document scrolling. Existing DM/player authorization is unchanged.
- Compendium: results and details reserve independent heights through loading, empty results and short/long entries, including the stacked phone layout. Existing detail-scroll reset remains local to the reader. Async filter reloads keep their previous footprint.
- Shared `v-stable-loading` directive: captures a panel's measured height before Vue replaces its contents, retains that minimum through the pending request, and restores the original inline minimum and priority after success, failure or unmount. Hidden panels are ignored. Applied to character-sheet opening/refresh, builder reference loading, rule/monster/item libraries, item composition, pack publishing, saved files and recovery panels. It does not retain private data or issue scroll commands.
- Character, builder and workshop navigation: `revealNavigationTarget` replaces unconditional scrolling with a check that reveals the requested heading only if it is outside the useful viewport. Explicit navigation stays immediate and respects reduced motion. Focus restoration uses `preventScroll`.
- Short sheet tabs and editor panels reserve a minimum reading footprint while long forms grow normally. Spell search and pack publishing dialogs reserve their frames; result scrolling stays inside the modal.

The reusable directive is registered in `src/main.ts`; future async panels can use `v-stable-loading="loading"`. New index/detail browsers should also reserve a responsive height in CSS, because a loading directive alone cannot reserve unknown first-load content.

## Verification

- `npm.cmd run build`: passed, including Vue/TypeScript checking.
- New directive/navigation regression tests: 8 passed. Cover pending replacement, repeated loading updates, cleanup after completion or unmount, restoring existing inline styles, content-box sizing, hidden elements and conditional navigation.
- Broader `npm.cmd test -- src shared`: 154 passed, 1 failed. The failure is the unchanged `src/lib/character-builder.test.ts:71`, whose expected Dagger object omits the `index: 'dagger'` property returned by the unchanged builder. Neither file was modified by this work.
- Read-only local browser fixtures with 650ms detail delays: notebook long-to-short selection and compendium detail selection preserved document position, frame height and index scrolling on desktop. Detail scrolling reset locally.
- A same-origin 390×844 iframe exercised real responsive layouts: notebook library/reader switching and return, compendium delayed selection, character Features/Bio navigation, and item/monster workshop areas. No horizontal overflow. The notebook frame stayed identical; one viewport reading differed by less than one CSS pixel due to fractional browser scaling, with unchanged layout top and restored library position.
- Inspected a static rendering of the actual mobile notebook DOM and production CSS. The bounded reader, controls and footer remain visible and accessible. Fonts in that static rendering use fallback faces; geometry checks ran against the actual loaded application fonts.

All fixture data is disposable and the local fixture server rejects write methods. The live Revalon room and Obsidian vault were not touched. Pre-existing workspace changes were preserved; originals of touched files were captured under `.preview.local/site-stability-before` before editing.

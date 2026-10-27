# Full-size Campaign Codex preview

Selected concept A, in the actual site's shell, typography, appearance settings and theme tokens. The approved layout is now the main notebook implementation; this server runs that same component against disposable campaign copies. It has not been deployed.

```powershell
npm.cmd run preview:notebook
```

Open http://localhost:5182/rooms/000000000000000000000ca1?section=notebook. Stop with Ctrl+C. Set `CODEX_PREVIEW_PORT` to use a different port.

The server binds to the local machine only. It reads the 39 saved-and-verified drafts and 26 folders from `backups/revalon-notebook-review-2026-10-22/proposals.json`. That ignored local review file must be present. Campaign prose is copied; old bibliography paths are displayed as session numbers, following the current source preference. Wren's encounter remains unconfirmed. No Obsidian files or live entries are written.

Edits, new entries, folder permissions, connections, recoverable versions and trash are held in the local server's memory. They survive browser refresh, and reset on server restart or **Reset local changes**. Bookmarks belong to this local browser and room. The reset button also clears them in that browser.

## Layout and feature coverage

`[Entry types | Search, relevance, entry list | Dossier]`

- Direct People, Places, Objects & clues, Groups, Sessions and Bookmarks views. The existing approved group is classified under Groups for this design iteration; no place entries have been invented.
- All 39 approved entries, twelve chronologically ordered session recaps, and the original geographic hierarchy. An entry is stored once and can be found through multiple views.
- Description, Encounters and Connections organize the full saved body by its existing headings. Complete clues, letters and DM notes remain available. Source chips open accessible session recaps. They stay disabled if a player cannot read the recap.
- Places open with an Overview showing the description and linked places, NPCs, groups, clues and sessions in separate groups. Only accessible connections appear. Plot notes use the existing description; dedicated plot entries and location filters remain future options.
- Search through titles and bodies, accent-insensitive matching, character relevance, per-browser bookmarks and refresh.
- Create/edit with category, title, folder, Markdown reading preview, selected-text highlighting, whole-entry sharing, relevance and bidirectional entry connections.
- Place header image upload, preview, replacement and removal. JPG/PNG/WebP inputs up to 10 MB are resized locally and saved as a small raster with the protected entry. A low-opacity backdrop and theme fade keep the name readable without moving the header when the image loads. Text history leaves the current image unchanged.
- Folder creation, nesting, renaming, visibility for DM/room/selected characters, removal and recovery. Folder creation explicitly selects the journal or object collection; cross-collection parenting is prevented.
- Version history, text-only restore, soft deletion and recovery. Revision checks retain the existing draft-conflict workflow. The fixture history starts with the approved copy; production history is not imported.
- DM/Fade/Volenta viewing switch. Fixture character names represent the two campaign characters for permission testing; their character sheets are not imported. Only the approved shared book is initially visible in player mode. Entry, ancestor-folder, name, count and connection filtering happens in the local server. Player mutations are rejected; private history is not returned.
- Desktop independent list/reader scrolling, Back with reading-position restoration, fixed loading footprints, a reserved notice slot, and phone library/reader switching. Focus does not move the document. Arrow keys navigate dossier tabs; reduced motion is honored.

The real site navigation and appearance panel are present. This server focuses on the notebook; unrelated application API actions are unavailable. It has no external API proxy or database connection. Passage-level sharing is not implemented. Nothing is published.

## Design decisions

The structure follows the selected subject-first codex. Geography & folders has been removed from browsing. Folder organization and inherited sharing remain in a separate DM-only Folder settings disclosure; selecting a folder there does not filter the library. Existing headings determine the dossier tabs; no lore or relationships are generated.

Colors come from existing `--cb-*` theme variables, including paper, field, ink, muted, line and accent. The user's current Obsidian/crimson appearance uses canvas `#0e0b0d`, paper `#1a161a`, ink `#f1edef`, muted `#c1b9be`, line `#623a45`, and accent `#d37583`. Other site themes remain selectable. Names use the site's title font; reading prose retains Georgia; navigation follows the site's Barlow controls. Text stays left aligned, and the dossier is bounded to a readable line length.

`src/components/notebook/CampaignNotebook.vue` is the single notebook implementation used by the main application and this local server. The server only enables its local-copy banner and reset control; production has no reset endpoint. The category, session-source and reading-tab helpers live in `shared/notebook-codex.ts`; legacy saved text and permissions need no migration. New category choices are persisted when entries are edited. Only the DM can move existing entries between the journal and object collections.

Entry navigation, dossier tabs and deliberate category changes use the existing site motion directive. Animations begin after content arrives, retain the fixed frame, and do not run on periodic refresh. The existing hover, press and disclosure animations remain. Both the appearance panel's Reduced setting and the OS reduced-motion preference disable notebook animations.

## Verification

- `npm.cmd run build` and `npm.cmd run typecheck` passed.
- `node --test design/notebook-codex/model.test.mjs`: nine tests cover typed incoming/outgoing place connections, image persistence/removal/list omission, development resume, filtered player responses, ancestor visibility, selected-character sharing, revision conflict, CRUD/trash/restore/reset, complete section retention and session-only sources.
- The existing eight scroll/loading regression tests passed.
- Actual site browser checks at desktop size and a same-origin 390×844 frame covered browsing, text search, session links, Back/tab restoration, bookmarks, full editor, Markdown preview, entry connections, save/history/restore, entry and folder recovery, folder permission editing, player filtering and no horizontal overflow. Entry loading and phone switching preserved the frame and document scroll position.
- Desktop and phone notebook screenshots were visually inspected using the actual rendered DOM and current theme. No deployment or live campaign write was performed.

The prior broader test run has one known unrelated failure in `src/lib/character-builder.test.ts:71` (Dagger's `index` field); this preview does not change that code.

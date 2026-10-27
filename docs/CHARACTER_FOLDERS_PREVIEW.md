# Character folders — local design review

The user requested one or two iterations of a filesystem-style organisation layer for the personal Dashboard, preserving the existing character chooser and sheet. The initial work was preview-only. The full-width explorer-tree revision was subsequently accepted and explicitly authorised for publication; see [release verification](CHARACTER_FOLDERS_RELEASE_2026-10-22.md). The design-review notes below record the local preview stage.

## Design direction

Keep the existing appearance system and its selectable fonts. No new font, ornamental texture, or palette is introduced. The base semantic palette remains canvas `#efeee7`, paper `#faf9f4`, ink `#2c3c32`, muted `#65755f`, line `#d6ddcd`, and accent `#315a44`; existing theme settings override these tokens. Display headings use the existing display/folio font, and controls use the existing body font. Labels and names align left; counts align right. Motion follows the existing user-triggered roster/sheet transitions and reduced-motion settings.

Iteration 1: explorer tree inside the left character chooser. Campaigns and nested folders remain visible as drag targets beside the sheet. The chooser retains its collapse control. The wider 276-pixel chooser provides room for meaningful campaign/folder names.

```text
Folders + characters | Existing full character sheet
  Revalon            |
    Main Characters  |
    NPCs             |
```

Iteration 2: breadcrumb path and folder shelf above the existing chooser/sheet workspace. Opening a campaign shows its child folders. This gives folders more horizontal room and restores the original chooser width, at the cost of more vertical space and less direct access to distant folders.

```text
All characters / Revalon
[Main Characters] [NPCs] [Companions]
Characters           | Existing full character sheet
```

Both designs use the same account-owned folder API and existing sheets. This is a restrained organisation layer; a second character-card system or a separate full-screen file manager would displace the format the user asked to retain.

### Follow-up: folder browser before sheet selection

The user preferred the explorer tree and requested the full workspace for browsing until explicitly opening a character. The tree preview at http://127.0.0.1:5177/ now starts with a full-width library: the folder tree and compact character entries use the available space, with no automatically selected or loaded sheet. Choosing a character restores the existing sheet beside the collapsible chooser. Back to folders closes the sheet and restores the browser's scroll and keyboard focus; folder, search, selection, and expanded branches remain intact. Reload starts in the folder browser. Explicit `?character=` links still open the requested character.

Browser verification confirmed no initial character-detail requests, keyboard opening and return, focus restoration, reload behaviour, and browser/sheet layouts from 320 to 1440 pixels without horizontal overflow or uncaught errors. Screenshot review corrected unnecessary vertical gaps on desktop and placed folders before the character heading on phones. The final build passed. Review artifacts are `browser-review.mjs`, `browser-results.json`, and `browser-*.png` in the ignored preview directory. This revision remains local and unpublished.

## Behaviour

Folders can be nested up to six levels, renamed, or moved. Drag a character, or select several and drag one of them, onto a folder. The explicit destination selector and Move button provide an equivalent keyboard/touch path. All characters remains an inclusive view; Unfiled contains characters without a folder. Empty folders are valid. Folder counts describe directly filed characters.

Browsing folders keeps the open sheet in place. If it is outside the current folder, a location notice and Show its folder action make that relationship explicit. Folder operations never alter character sheet timestamps, contents, room assignments, or party selections. Removing a leaf folder moves its characters to the parent or Unfiled; sheets are retained. Subfolders must be moved or removed first.

Folder organisation is stored per account in its own collection, with revision-based atomic updates. Conflicting changes reload the latest folders and require a deliberate repeat; uncertain writes are not replayed. Per-device storage remembers only the currently browsed folder and existing roster preferences.

## Review and validation

Both working designs are available locally:

- Explorer tree (recommended): http://127.0.0.1:5177/
- Breadcrumb / folder shelf: http://127.0.0.1:5178/

The tree is the recommended starting point for a growing campaign library: nested destinations remain visible beside the sheet. The shelf offers more room for names and keeps the original chooser width, but hides other branches until navigated. Both previews share the same saved organisation.

Screenshot and interaction review led to several refinements: selection and destination controls now appear only after choosing Organise; empty accounts retain folder creation; empty shelf spacing is tighter; long names wrap; font sizes follow the appearance text scale; and cached placement maps/counts avoid repeated scans during rendering. The sheet remains open while browsing, and collapsing the chooser returns more than 200 pixels to it.

Verified in the browser with synthetic local accounts and characters:

- Nested creation, rename, reparent, native drag, keyboard batch moves, reload persistence, and Show its folder.
- Character sheet data and timestamps remain unchanged after filing.
- Account isolation, foreign-character rejection, invalid nesting, stale revision conflicts, and simultaneous first writes (one succeeds, one receives 409).
- Empty accounts, long names, visible focus, dialog Escape/focus restoration, three appearance themes, enlarged text, and reduced motion.
- Both layouts at desktop, tablet, and phone widths down to 320 pixels without horizontal overflow or uncaught browser errors.

The final production build and server typecheck passed. Twenty-three focused tests passed across character-library organisation, party calculations, and room access/update behaviour. Native preview automation snapshots timed out twice; browser review used independent headless Edge after that fallback became available.

These are local previews only. They use a separate API on port 4014 and explicitly local MongoDB; no production records were modified and nothing was published. Existing character export/restore does not include the separate folder collection yet.

## Local preview setup

The ignored configuration is `.preview.local/character-folders/config.ts`. Start the API with `PORT=4014` and `MONGO_URI=mongodb://127.0.0.1:27017/dnd_site`, using `npm --prefix server run start`. Start Vite with `npm run dev -- --config .preview.local/character-folders/config.ts`; set `CHARACTER_FOLDER_LAYOUT=shelf` for the second instance. The shelf is a preview-only source transform; the application source defaults to the tree. API proxies preserve the request origin with `changeOrigin: false`.

Browser scripts, screenshots, and results are stored under the ignored `.preview.local/character-folders/` directory (`review.mjs`, `final-checks.mjs`, `results.json`, and `final-results.json`). Demo credentials are provided privately in the conversation, not tracked here.

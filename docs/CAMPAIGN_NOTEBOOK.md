# Campaign notebook

## Purpose and agreed design

The notebook is a shared game-room library, separate from a character's personal
Bio & notes. It is a prominent room section next to Characters. Character sheets
provide an Open notebook shortcut, with a room picker outside a game room and
an optional Relevant to character filter inside it.

The approved Campaign notebook design keeps the reading area quiet: a bounded
folder/entry index, a small pinned section, a scrollable reader and collapsed
connections/history. On narrow screens, Browse library toggles the index.
The room heading, management panel and notebook share their outer width.
Existing theme, text size, tactile buttons, panel motion and reduced-motion
preferences apply. No new animation library is used.

## Using it

1. Open Game rooms, choose a room, then Campaign notebook.
2. Choose Journal for shared notes or Story items for important objects/clues.
3. Create folders and entries. Folder names are visible to the whole room;
   folders organize entries and never grant access to their contents.
4. Write a title and Markdown description. Select description text and choose
   Highlight selection to mark it. Save changes explicitly saves a version.
5. The DM chooses Whole room, Selected characters, or DM only. New DM entries
   default to DM only; new player notes default to Whole room.
6. Relevant to is an organizational filter, independent from access/sharing.
7. Connect entries in Edit. Connections appear in both directions, filtered by
   each reader's access. `[[Exact connected title]]` becomes a clickable link;
   `[label](note:ENTRY_ID)` uses a stable ID and survives renaming.
8. Pin up to 12 entries for quick access. Pins are per user/room/browser, not
   shared room settings. Pinned and ordinary lists have bounded scrolling.
9. History & versions displays saved text. Restoring text creates a new version
   and preserves the current audience, connections and character relevance.
10. Delete entry moves it to Recently deleted. Recover entry reverses this.
    Removing a folder leaves its notes available under Unfiled; recovering the
    folder reunites those notes. No permanent purge is exposed.

## Permissions

| Capability | DM | Player |
| --- | --- | --- |
| Read room-shared notes/items | Yes | Yes, with current membership |
| Read targeted notes/items | All | When currently assigned a selected character |
| Read DM-only entries | Yes | No |
| Create/edit/delete/recover Journal entries | Yes | For accessible entries |
| Manage Story items/folders | Yes | No; read only |
| Change sharing or relevance | Yes | No |
| Organize Journal folders | Yes | Yes; only DM may remove/recover nonempty folders |
| Use notebook without assigned character | Yes | Room-shared entries only |
| Mutate notebook in DM's Player view preview | No | Preview is explicitly read only |

These checks run on the server for every read/write, including history, search,
connections, recovery and preview. Targeted access follows current assignments
and current character ownership; another room's entry IDs do not grant access.
History also filters each old version by its recorded audience, so sharing a
formerly private note does not expose its private historical text.

## Implementation

- `shared/notebook.ts`: frontend/backend response contracts.
- `server/models/Notebook.ts`: Notebook entries/folders and NotebookRevision.
- `server/routes/notebook.ts`: authenticated, room-scoped API mounted at
  `/api/rooms/:roomId/notebook` before the existing room router.
- `src/components/notebook/CampaignNotebook.vue`: library, reader, editor,
  folders, sharing, connections, history and conflict handling.
- `NotebookText.vue`: restricted Markdown reader using Vue text nodes. Raw HTML
  and executable URLs are not evaluated; external links allow HTTP(S) only.
- `NotebookShortcut.vue`: loads the room picker only after the user opens it.
- `RoomView.vue`: lazy notebook import, room navigation and draft/save guards.

Index requests return 60 summaries per page, not note bodies or histories.
Descriptions load on selection; history loads on request, 15 versions per page.
Titles are limited to 120 characters, descriptions to 60,000 characters, and
explicit connections/character selections to 100 IDs. Request validation and a
write rate limit apply. Notebook API responses use the site's private/no-store
policy. Only pin IDs are stored in browser localStorage.

Visible notebooks refresh every 15 seconds and on focus; this is polling, not
simultaneous collaborative typing. Dirty drafts are not overwritten. Revision
checks reject stale writes with HTTP 409 and offer a comparison with the latest
saved entry. Replacing that version requires an explicit user choice. Saves,
soft deletions, recovery and revision records use MongoDB transactions, requiring
Atlas or a MongoDB replica set. Existing production Atlas meets this prerequisite.

Character reads/resource writes remain separate. Character polling pauses while
the notebook is open; the mounted sheet is retained for return navigation.
Notebook data is stored in new collections, without a character migration.

The reader currently handles paragraphs, headings, flat lists, quotations,
fenced code, bold, italic, inline code, highlights, connected wikilinks and
HTTP(S) links. It is not a complete Obsidian Markdown implementation: attachments,
tables, nested formatting/lists, embeds, callouts, YAML properties and heading/
block navigation require the later import/reader pass. Original text is retained.
Unknown links display as unresolved text rather than guessing a destination.

## Next stage: Obsidian import (planned, not implemented)

Obsidian stores notes as `.md` files and supports wikilinks and Markdown links.
See [Markdown files](https://obsidian.md/help/import/markdown) and
[internal links](https://obsidian.md/help/links).

Recommended sequence:

1. Upload a selected folder/ZIP with Markdown notes and optional attachments.
   Do not upload the vault's `.obsidian` configuration, plugin code or secrets.
2. Preview folders, titles, aliases, properties, tags and attachment references.
   Preserve the original source and provenance; never execute plugin content.
3. Resolve links using full vault-relative paths and aliases to stable entry IDs.
   Ambiguous duplicate names, missing links and unsupported syntax go to a
   review list. Renaming an imported entry must not break resolved links.
4. Import as DM only. Review and share chosen entries afterwards. Source-folder
   names also need review because notebook folders are currently room-visible.
5. Store source path/import batch/hash so reimport can offer Skip, Update or
   Create copy, with conflict review when the site copy was edited independently.
6. Treat this as an import, not automatic two-way sync. Sync can be considered
   separately once ownership and conflict behavior are agreed.

The existing Markdown source, stable entry IDs, audiences, version history and
connections support this direction. Import provenance, attachment storage and
path/alias resolution are still work to do, not existing compatibility claims.

## Next stage: linked maps (user confirmed 21 October 2026)

The user wants map images with clickable note pins, rather than converting
existing Obsidian map-plugin projects. Proposed first implementation:

- Upload an image, pan/zoom it, and place named pins linked to existing entries.
- Store image dimensions and normalized pin coordinates (`x`, `y` between 0 and
  1) so resizing/zoom does not move pins relative to the map.
- Use stable entry IDs. Clicking a pin opens that entry in the notebook reader;
  a note can also offer a return link to its map location.
- Give maps their own room/character/DM visibility. Filter pins and linked-note
  titles on the server as well; a hidden note must not leak through a map label.
- Keep images in suitable object storage with access control and explicit size/
  quota limits. Avoid embedding image binaries/base64 in note documents or
  revision snapshots. Decide the free-storage provider before implementation.
- Keep DM pin placement and player browsing separate. No movement, encounter
  automation or replacement for Owlbear Rodeo is required for this first pass.

## Review and release state

Published on 21 October 2026 at https://dndoldal.vercel.app.

- Feature commit: `16d8651`.
- Production deployment: `dpl_4owAUiqmwAa7eByZzJpDmE7bctoF`.
- Deployment URL: https://dndoldal-ezbqpgsfi-dndenjoyerstudio.vercel.app.
- Previous production retained: `dpl_DLxxhoPFfVrcjVJ72TJQ2hN31sfq`.
- Git backup tag: `backup/pre-campaign-notebook-2026-10-21` (`c7ddf6b`).

The release adds new notebook collections and does not migrate existing character
or campaign data. Obsidian import and linked maps remain planning only.

Review used the real Vue UI and Express/Mongoose implementation against a
separate loopback Docker replica set, seeded with disposable users, two
characters, 76 Journal entries and a Story item. Desktop panel widths were
measured equal; narrow-screen overflow was checked at 390 CSS pixels. Editing a
note saved successfully and created a history version. A player could read the
assigned-character history, could not read a DM-only entry (404), received no
private notes in the index, and could not create a Story item (403).

Frontend and server typechecks and the production build passed. No automated
test suites were added or run. The Vercel production build/typecheck also passed.
After promotion, the public site's deployment ID matched the release, health
returned 200, and the notebook route returned JSON 401 when signed out. Live
room/notebook bundles were available. The release browser was signed out, so
private-room editing was reviewed locally rather than using the user's live
account or writing review entries into the campaign.

Rollback checkpoint before this work: `c7ddf6b`. Reverting the notebook feature
commit restores the former UI/API; new notebook collections remain retained for
recovery and are not deleted by a code rollback. Later notebook data must be
included explicitly in any complete room/site backup tooling: existing character
and Workshop exports do not yet export room notebook entries.


To roll the live site back to the preceding deployment:

```powershell
vercel rollback dpl_DLxxhoPFfVrcjVJ72TJQ2hN31sfq --scope dndenjoyerstudio --yes
```

This restores the prior application while retaining any notebook records created
since this release. They become available again when the notebook code returns.

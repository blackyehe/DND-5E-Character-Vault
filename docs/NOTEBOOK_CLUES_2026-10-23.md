# Quest clues

Keep the accepted Codex layout and theme. A quest gains a Clues reader tab, with a simple vertical list of gathered evidence and session sources. Use the existing paper/ink/accent palette (#0e0b0d, #1a161a, #f1edef, #c1b9be, #623a45, #d37583 in the current theme), heading font, Barlow controls and left alignment. Status labels distinguish DM only from Whole room. Existing panel animation and bounded reader scroll apply; no new dashboard or nested folders.

Only the DM manages clues. New clues default to DM only. Each clue has a title, optional description, session numbers and an individual Show to players / Hide from players action. Quest text stays room shared. Players receive only shared clues from the API; hidden IDs, counts, text and search matches are excluded. History restores title/body only and never restores clue visibility. Older clients omitting the clue array preserve current clues. Finished quests retain their clues.

Campaign content still requires individual approval. The approved Bill Clinton quest was saved separately, with no clues added. Preview fixtures are invented software test data, never live campaign content.

Released to production on 23 October 2026. See [release verification](NOTEBOOK_CLUES_RELEASE_2026-10-23.md).

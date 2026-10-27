# Notebook quests

Requested 22 October 2026: a Quests Library tab for active and finished quests, including ongoing agreements such as Bill Clinton's workshop deal. Every quest must be visible to the whole room. Individual campaign-entry approval remains required.

## Design

Extend the accepted Codex layout instead of introducing a separate board. Keep existing theme tokens, title font and Barlow controls: canvas #0e0b0d, paper #1a161a, field surfaces from the selected theme, ink #f1edef, muted #c1b9be, line #623a45, accent #d37583 in the user's current palette. Other themes remain supported. Left-aligned Library navigation gains Quests before Sessions. Active and Finished are adjacent filters above the independently scrolling list. The reader keeps its description, session sources and connections, with a restrained status strip and DM action. Status changes reuse existing list animation; background refresh stays still and reduced-motion preferences remain effective.

The design review favors the established Library over a new dashboard: quest status is the only new visual signal. Status labels use both text and color. Finished means no longer active and can include completed, failed or abandoned outcomes. Outcome details remain prose rather than assuming success.

## Behavior

- Quests are an explicit entry category. Existing NPCs, deals and recaps are never automatically converted.
- Quest status is Active or Finished. The DM can change it from the reader or editor. Finished quests remain readable and can return to Active.
- Only the DM can create, edit, change category/status, delete, recover or restore quests. Players can read and bookmark them. Player preview remains read-only.
- The API requires Whole room sharing, no selected-character restriction and no folder for quests. A private ancestor therefore cannot hide a quest. Existing quests remain in Quests rather than being recategorized into private entries.
- Quest counts, status filtering and pagination are calculated after existing access checks. Connections continue to hide private NPCs, clues, places and sessions from players.
- Text restoration preserves current quest status, sharing and links. Older clients omitting status retain a finished quest's state. Other entries have no quest status.
- Existing DM-only NPCs and story items retain their sharing. Public quest summaries must be approved separately and omit hidden lore or mechanics.

## Content review

Bill Clinton's workshop investigation is the first proposed shared quest. Its existing NPC entry remains DM only. The user's approval of Badu and Bill's two headings/direct crystal link did not approve a new shared quest body. Other unfinished threads will be presented individually after checking actual outcomes against session notes.

## Verification and release

Released to production after local checks and a staged build. Disposable preview data remains separate from the existing localhost:5182 notebook and its user-created entry. See [release verification](NOTEBOOK_QUESTS_RELEASE_2026-10-23.md). No production quest content has been added; individual approval is pending.

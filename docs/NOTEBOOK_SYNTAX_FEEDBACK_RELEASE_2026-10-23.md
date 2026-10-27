# Notebook syntax feedback — 23 October 2026

Adds immediate visual feedback to the Campaign Codex editor and quest clue descriptions, using the existing notebook typography, appearance tokens and safe Markdown reader.

## Behaviour

- A visible live reading preview renders bold, italics, highlights, inline/fenced code, headings, ordered/unordered lists, quotations, external links, session references and notebook links. Preview links do not navigate away from an unsaved draft. The preview can be hidden.
- `[[Title]]` resolves automatically when exactly one accessible notebook entry matches, across categories and folders. Missing and duplicate titles remain visibly unresolved.
- Typing or selecting a wiki link offers up to eight matching entries. Arrow keys/Enter, pointer or touch select a target; Escape dismisses the choices. Lookup is accent-insensitive; automatic exact resolution preserves accent distinctions and handles Unicode composition, case, aliases, `.md` and heading suffixes.
- Choosing a suggestion inserts `[[entryId|Title]]`, retaining a custom alias/heading if supplied. IDs keep chosen links working after renames and distinguish duplicate names. Links typed by title continue to follow that title.
- A small formatting toolbar preserves selections and restores focus. Syntax help documents the formats the existing reader supports.
- Quest clue textareas remain compact; phone formatting buttons meet 44px targets. No new animations are introduced.

## Data and access

The new `GET /api/rooms/:roomId/notebook/link-targets` returns only entry IDs, titles, categories, collection and folder names. It uses existing membership, player-preview, entry audience and ancestor-folder permissions. Deleted entries and entries inside unavailable/deleted/cyclic folders are excluded. The catalog includes matches beyond the paginated library and does not load descriptions, private clues, covers or character sheets.

The client loads a catalog independently of selected-sheet state, refreshes it alongside the existing notebook polling, and invalidates it after note/folder mutations. Typing performs no API requests. Requests are aborted and responses rejected when room/player scope changes or the component unmounts. Failed lookups offer Retry without blocking text editing. The reader indexes targets once per catalog change rather than searching the entire catalog for each rendered link.

Saving still uses the existing revision check and conflict workflow. No saved notes are migrated or rewritten automatically. Explicit Connected entries remain separately managed; the new inline wiki links do not silently change that relationship list. All text remains Vue text nodes; HTML and executable URLs are not evaluated.

## Review and verification

Three passes: functional implementation; desktop/tablet/phone screenshot review with density, touch and keyboard refinements; then access, request, retry/conflict and compiled-build verification.

- 36 focused tests pass across `shared/notebook-links.test.ts`, `src/components/notebook/NotebookText.test.ts` and `server/routes/notebook.test.ts`. Tests cover matching/ambiguity, stable insertion, code exclusions, safe rendering, and the complete permission-filtered catalog.
- Frontend typecheck/build and server typecheck pass against an isolated copy of current production plus the six intended source files.
- 18 browser checks pass against both development and the compiled production frontend. They cover live formatting, links/ambiguity, keyboard and touch input, selection/focus, 1440/820/390px layouts, saving/navigation, simultaneous-edit conflicts, request counts, retry and changing player scope. Browser writes are intercepted into synthetic notebook data; no real campaign data is modified for verification.
- Native collaborative browser snapshots timed out twice. Browser verification used the documented fallback in an isolated Edge context.

## Release boundary

Baseline: `dpl_7tHoxpxAXpXgmjr4eqcntDzEXkNV`.

Live release: `dpl_8uey3zkRBBsjcgDisBrATFmcfvjh`, promoted to https://dndoldal.vercel.app after staged source/hash and API-health verification. Public checks confirm the notebook bundle, retained feat/navigation fixes, protected endpoints (401), healthy API (200), and desktop/mobile login redirects without runtime errors. Rollback target is the baseline above.

Exactly six source files are changed: `shared/notebook-links.ts`, `src/components/notebook/NotebookEditor.vue`, `NotebookText.vue`, `CampaignNotebook.vue`, `NotebookQuestClueEditor.vue`, and `server/routes/notebook.ts`. All 317 deployment source inputs are checked against SHA1 hashes of reconstructed production plus this delta. Unrelated checkout edits are excluded.

Evidence and deployment metadata: `.preview.local/notebook-syntax-20261023/` (local only). Production verification is read-only. No commit or remote source publication is made.

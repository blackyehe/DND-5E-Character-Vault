# Feat reference panels and room explanations

Feat previews now render outside disclosure panels so the existing disclosure animations cannot clip them. Native feat and resource dialogs remain mounted while their contents load only when opened. Opening checks the native dialog's current state, and queued close events ignore an already reopened dialog. This fixes clicks swallowed immediately after Escape and retains keyboard focus restoration.

The room Party dashboard expands imported comma-separated Feats into individual expandable entries, showing a short rule preview and the full explanation on expansion. Feat rules use the same renderer in room references, Combat, Features & traits and full-reference dialogs. Duplicate imported definitions merge their source labels; different rules require an explicit source choice. Saved explanations remain available and missing definitions are identified without inventing rules. Legacy feat groups omit names already recorded individually while retaining original indices for pin/reorder writes.

Room reference requests use the existing membership/assignment-protected character references endpoint. They start only when Combat reference opens and reuse successful results while the selected character's features and library revision are unchanged. HP/resource refreshes and unchanged room polling do not reload definitions. Errors have an explicit retry. The overview does not mount a complete sheet or replace the selected-sheet store.

Validation:

- Frontend and server typechecks and production builds passed, including an isolated reconstruction of the latest production source with its own server dependencies. The first hosted stage caught an indirect browser API type import from the shared feat helper; replaced it with an independent structural data contract before retrying. The failed stage was never promoted.
- 39 focused tests passed, including six feat-resolution/list tests and existing party regressions. Vitest also selected existing isolated test copies.
- 16 browser checks passed on the compiled release: lazy scoped requests, imported lists and duplicates, rules search, missing definitions, ambiguous source choice, expansion, dialogs, Escape/immediate reopen, focus restoration, five rapid resource-dialog cycles, retry, polling reuse, full-sheet return, reduced motion, touch-only controls and responsive widths 1440/834/390/320. No uncaught browser errors or writes.
- Browser checks used local authenticated disposable characters and response-only test definitions. No production character data was modified. The native T3 snapshot operation timed out twice; verification used the established isolated Edge fallback.

Focused application delta: nine files, with no backend or schema changes. Source/evidence: `.preview.local/feat-panels-current-20261023/`; browser fixtures, screenshots and results: `.preview.local/feat-panels-release-20261023/`.

Production baseline: `dpl_D6hoSgrPN34jnwob92Hw4TFTWK3F`. All 314 baseline inputs were reconstructed and SHA1 checked, retaining the latest navigation, notebook, Maps and Compendium reader changes. None of the nine changed paths overlapped concurrent changes. All 315 dry-run input hashes match the reviewed manifest.

Limitation: a feat imported only as a name still needs a saved explanation or a matching definition in its permitted source library. Different matching rule versions remain an explicit reading choice; no character rules or saved feat selections are changed.

Rollback target: `dpl_D6hoSgrPN34jnwob92Hw4TFTWK3F`. No migration is involved.

Published: `dpl_7tHoxpxAXpXgmjr4eqcntDzEXkNV`, https://dndoldal-i418sxjj3-dndenjoyerstudio.vercel.app, promoted to https://dndoldal.vercel.app. All 315 uploaded source hashes matched the reviewed inputs. Immediately before promotion the public alias still pointed to the reviewed baseline. Staged and public health returned 200; unauthenticated party/reference access returned 401. Public assets serve the new feat explanations, retry and fixed-position previews, and retain navigation recovery. Desktop/mobile login and protected-room redirect checks passed without browser errors. Authenticated interaction checks were local, using read-only response overrides; no production character writes occurred.

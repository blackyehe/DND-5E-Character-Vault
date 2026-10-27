# Notebook focused reader — live 26 October 2026

The campaign notebook now offers **Focus view** on every entry and **Inspect clue** on quest clues. The reader provides a larger reading area, one clue at a time, Previous/Next navigation, and a mobile clue selector. Notebook links and Back work inside the reader. Close and Escape restore the notebook position and keyboard focus. Existing entry and clue visibility remains authoritative.

Production: https://dndoldal.vercel.app

- Deployment: `dpl_9aiXB7rcj34Mi9bp277AJa1KhZ9M`
- Previous live baseline: `dpl_Gzru3KaKmiyS59qndepGSxgMh4jW`
- Source: `.preview.local/notebook-focus-release-20261026/source`
- Evidence: `.preview.local/notebook-focus-release-20261026`

The approved preview was applied to a reconstruction of the then-current live deployment. All 367 previous input hashes were checked. Two existing files changed and two were added; 365 previous inputs remain identical. All 369 uploaded inputs matched the staged deployment before promotion. The public site's relevant served assets match that verified stage. Region `fra1` and the existing prepared Compendium reader flags were preserved. The shared dirty checkout's implementation files were not overwritten.

Changed files:

- `src/components/notebook/CampaignNotebook.vue`
- `src/components/notebook/NotebookQuestClues.vue`
- `src/components/notebook/NotebookFocusReader.vue` (new)
- `src/components/notebook/notebook-focus.css` (new)

Validation:

- Frontend typecheck/build and server typecheck passed.
- Twelve browser check groups passed using actual hosted frontend assets and disposable local read-only notebook fixtures: all seven categories, exact clue selection, long-clue scrolling, links and return, keyboard containment in both directions, restored focus/scroll, repeated reopen, 390px/320px layouts, player filtering, scope changes, and access revocation.
- No uncaught browser errors or notebook writes during those checks.
- Public health returned 200; protected character, notebook and Compendium APIs returned 401 anonymously.
- Public anonymous notebook navigation redirected to a working login on desktop and mobile.
- No production notebook data reads or production data writes were used for verification.

The T3 collaborative browser twice timed out on a staged snapshot; verification continued in local headless Edge. Fixture checks validate the compiled interface, not a signed-in campaign end-to-end. The gallery component is unchanged.

Inspect `verification.json`, `source-audit.json`, `expected-files.json`, `changes.json`, `stage-checks.json`, `stage-browser-results.json`, `live-http.json`, and `public-browser-checks.json` in the evidence directory for details. Future releases must reconstruct the current live baseline and preserve these changes; do not promote an older snapshot or the entire shared dirty checkout.

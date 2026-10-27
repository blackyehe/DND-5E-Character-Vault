# Collapsible party character selector

Added Show characters / Hide characters to the DM Party dashboard. Hiding the selector also hides its search and gives the selected character the full available width. The selected character, vitals, HP inputs, open references and sheet-return state remain mounted. The mobile picker uses the same toggle. The preference is stored separately for each user/room on this device and does not change party membership.

The toggle has a descriptive accessible name, expanded state and controlled-region references. Keyboard focus remains on it through collapse/expand. No animation, polling or save behavior was added or changed.

Validation: the isolated current-production frontend passed TypeScript and production build. Browser checks passed for Enter/Space activation, full-width expansion, unchanged selected character/vitals/HP form/references, no detail refetch, focus restoration from the sheet, persistence across reload, empty-search recovery, and layouts at 1440/834/390/320 pixels. No browser errors occurred. Native T3 snapshots timed out twice; verification then used isolated Edge/Playwright. No production data writes were needed.

Release evidence is in `.preview.local/party-selector-release-20261023/`. Reconstructed the latest live deployment `dpl_EyfrzLzqY9QyH3LFZJrBsMQ2QQGf` and changed only `src/components/party/PartyDashboard.vue` and `src/components/party/party-dashboard.css`. All 306 dry-run source hashes matched the intended manifest. Other work, including the latest quest/clue notebook release, is preserved.

Published deployment: `dpl_Aq4gz63cPu3zwH79uwUN77UkUHzr`, https://dndoldal-du719bwad-dndenjoyerstudio.vercel.app, promoted to https://dndoldal.vercel.app. All 306 uploaded source hashes matched the reviewed manifest; the public alias was unchanged from the reviewed baseline before promotion. Staged/public health returned 200. Public assets contain the new selector toggle and retained HP controls. Unauthenticated party access returned 401, desktop/mobile login redirects worked and no browser runtime errors occurred. No production character writes were made.

Rollback target: `dpl_EyfrzLzqY9QyH3LFZJrBsMQ2QQGf`. No migration is required.

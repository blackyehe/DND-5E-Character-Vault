# Folio refinements: staged release record

## Status — 20 October 2026

The requested refinements are implemented and committed as **ac33cdd** on `codex/folio-sheet-rollout`.

Frontend type checking and the production build pass. Vercel built the production-target deployment successfully, with automatic domain promotion disabled:

- Staged deployment: `dpl_4Jqq8rcqY5CWjoAW6Mn7biGBXnpd`.
- Staged URL: https://dndoldal-8cs7tqyuo-dndenjoyerstudio.vercel.app
- Vercel reported state: **Ready**.

Automatic approval review rejected the attempted promotion because it requires a fresh detailed preview and explicit user approval for this second production rollout. The promotion command did not execute. Do not retry until the user approves the revised preview.

## Current production and rollback

The main site, https://dndoldal.vercel.app, remains on the first Folio release:

- Current production deployment: `dpl_6xEEVqQmcqw3dXLACrAoyyEUWiP7`.
- Current application commit: `46ccd37`.
- Git checkpoint before these refinements: **pre-folio-refinements-2026-10-20**, pointing to `22536d2` (the initial Folio release plus its documentation).

After approval, promote the already-ready staged deployment. If rollback is later requested, restore `dpl_6xEEVqQmcqw3dXLACrAoyyEUWiP7` in Vercel or revert commit `ac33cdd` and deploy that source.

## Review material

The read-only comparison uses the real before/after Vue components and the same saved Ashton sheet. Summary opens first. Combat includes an optional zero-HP example showing the death-save section; the example changes only a local copy of the snapshot. Feature groups use the same six-entry column algorithm and available-width limit as the application.

Rules can expand, and whole groups can collapse in the comparison. Resource writes, XP awards, item changes and search are disabled there. Full reference dialogs and live updates are not simulated.

No automated test suite or production resource-write exercise was run. No database migration or character/resource mutation was made. The staged application and this record preserve the previously approved rollback arrangements.

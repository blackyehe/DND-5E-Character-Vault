# Dashboard and DM room character workspaces

## Release

- Published: 21 October 2026.
- Public site: https://dndoldal.vercel.app
- Implementation commit: `1c56012` on `codex/folio-sheet-rollout`.
- Deployment: `dpl_6gYMjLnfU3hTnXkhTkwFzUPSmhpe`.
- Deployment URL: https://dndoldal-9cq1a5ul9-dndenjoyerstudio.vercel.app
- Authorization: the user confirmed “Yes—implement and publish”, then requested the same principles and animations for the DM view inside rooms.

## Changes and purpose

The dashboard now keeps a searchable character roster on the left and opens the selected character's existing complete sheet beside it. Imports stay on the dashboard; the imported sheet opens after success. New-character creation returns to the dashboard when started there. Duplicate, export and delete remain available in Character actions. The standalone sheet route is still accessible.

The DM room uses the same roster and sheet layout. Each entry identifies its assignment, and the selected sheet has an Assigned player control. Bulk assignments and invitations remain under Players & assignments. The temporary player-preview switch remains available.

Both workspaces remember their own selected character and roster-collapse preference on the current device, scoped to the signed-in account and room. They remember each character's last non-editor tab while the workspace stays mounted. Unsaved permanent edits require confirmation before switching. Ongoing saves block switching. Failed imports keep their preview available.

Character changes use a brief expressive sheet transition after fresh data arrives. Roster width and the dashboard import drawer animate in response to user actions. Existing flowing tab/panel motion and tactile controls remain. Animation does not delay or schedule saves; reduced-motion preferences disable it. Narrow sheets move the resources into their existing collapsible layout.

No backend routes, database schema, assignment permissions or polling intervals changed. Existing room refresh remains approximately three seconds for the selected sheet and fifteen seconds for room details. This release does not add instant push updates or a new loading cache.

## Review performed

- Frontend type checking and production build passed (219 modules). No automated tests were added or run.
- Actual app reviewed against a disposable, in-memory local API. Local resource save persisted after switching away and back; character switching, roster collapse, assignment changes, dashboard link-import preview and completed import worked. Import selected the new sheet without leaving the dashboard.
- The unsaved-edit guard opened a native confirmation during local review. The browser automation session then stalled, so accepting/cancelling that native dialog was not verified through automation; the guard paths were reviewed in source.
- Reduced mode reported a zero-second roster transition and no horizontal page overflow at the checked desktop viewport. Small-screen layout rules were reviewed in source; no separate phone-device review was performed.
- Local temporary player view still identified unsaved preview state and omitted permanent-edit navigation. Local browser error/warning log was empty for the completed room review.
- Vercel reported Ready; public-domain inspection confirmed the deployment above. `/api/health` returned `{"ok":true}`.
- Signed-in live dashboard and existing Revalon room displayed the real roster, full sheet and new DM assignment control. Live review used navigation only; production resources, assignments and characters were not edited.

## Immediate rollback

Previous live deployment: `dpl_3eKoPxsgrPWCU7in3GpLYHx4Wnf5`.

Previous URL: https://dndoldal-2r0m04he7-dndenjoyerstudio.vercel.app

```powershell
vercel rollback dpl_3eKoPxsgrPWCU7in3GpLYHx4Wnf5 --scope dndenjoyerstudio --yes
```

The Vercel dashboard can also restore that deployment. This restores the application version while retaining current database data and play state. Rollback was retained and documented, not executed.

## Source rollback

- Git checkpoint `pre-dashboard-workspace-2026-10-21` points to `ac74a0e`, before this implementation.
- Revert commit `1c56012` in GitHub Desktop to remove the workspace implementation, then rebuild and deploy. Reverting source alone does not change the live Vercel application.
- Local screenshots: `.preview.local/dashboard-workspace-live.png` and `.preview.local/room-workspace-live.png`. They are excluded from deployment and Git.

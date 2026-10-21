# Character switching: preserve page position

## Cause and correction

Switching characters clears the old saved sheet while the next request loads. That temporarily reduced the document height to the workspace header and roster, so the browser clamped its scroll position upward. The new sheet subsequently appeared at that changed position.

The dashboard and rooms now reserve the current sheet container's height before switching. Once the selected sheet request finishes and Vue renders its result, the reservation is removed and the current page position is restored without smooth scrolling. Deliberate user scrolling during loading is respected. A shorter final sheet clamps at its available end. The reservation is also released on load failure or when leaving the workspace; late completions from unmounted sheets are ignored.

This change does not retain an interactive copy of the previous character or change save paths, loading caches, polling or character rules.

## Review

- Frontend type checking and production build passed (220 modules).
- Actual app manually reviewed against the existing disposable local API. Using the visible sticky roster buttons, the dashboard stayed at 399px before and after switching; the DM room stayed at 396px.
- No automated tests were added or run.
- Implementation commit: `9ddb52c`.
- Published deployment: `dpl_37LpMZJUDmwkMowMQy1mSgLVS1Ny` (https://dndoldal-ev9vfvoy5-dndenjoyerstudio.vercel.app). Public-domain inspection confirmed Ready and `/api/health` returned `{"ok":true}`.
- Signed-in live dashboard review: Fade to Volenta stayed at 396px during loading and after completion; the temporary height reservation was removed. Review did not edit production character data.
- Signed-in live DM room review: Fade to Ashton also stayed at 396px after completion. Browser error/warning log was empty for this review. Screenshot: `.preview.local/character-switch-scroll-fixed.png` (excluded from Git and deployment).

## Rollback

- Git checkpoint: `pre-character-scroll-fix-2026-10-21` (previous source state `f81dda6`).
- Revert `9ddb52c`, rebuild and deploy for a source rollback.
- Exact preceding live deployment: `dpl_6gYMjLnfU3hTnXkhTkwFzUPSmhpe`.

```powershell
vercel rollback dpl_6gYMjLnfU3hTnXkhTkwFzUPSmhpe --scope dndenjoyerstudio --yes
```

Application rollback retains the current database and play state. Rollback is documented, not executed.

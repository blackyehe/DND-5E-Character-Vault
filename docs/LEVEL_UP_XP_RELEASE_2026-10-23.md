# XP-gated level-up navigation

The Level up option now appears only when the saved character XP reaches the next character-level threshold. Uses the same XP table as the sheet's XP progress display. Existing owner/DM, preview, Shadow Champion and level-20 restrictions are retained. This applies to standalone and embedded character sheets; direct `?advance=1` navigation cannot open an ineligible wizard.

The option reacts to refreshed XP and the new character level after advancement. When another level is not yet earned, completion returns keyboard focus to Combat. An eligible cancelled wizard returns focus to Level up. Eligibility changes are observed synchronously so a successful save can complete its own wizard callback before the UI closes; the normal completion message is preserved.

Validation:

- TypeScript and production build passed on an isolated copy of current live source.
- All 16 existing level-up tests passed.
- Browser checks covered all 19 next-level thresholds: one XP below hides the option; the exact threshold shows it. Level 20 remains hidden with excess XP.
- Below-threshold direct URL, eligible URL, cancellation focus, refreshed XP increases/decreases and phone navigation passed.
- A complete Fighter 5 to 6 wizard flow with a browser-intercepted PATCH confirmed the completion message, new level, unchanged XP, hidden next advancement and Combat focus. This test did not write to the database. Threshold fixtures were browser response overrides only.
- No browser runtime errors. Browser verification used the established isolated Edge/Playwright fallback following repeated native T3 snapshot timeouts earlier in this thread.

Release evidence: `.preview.local/level-up-xp-current-20261023/`. An earlier baseline was superseded by a concurrent release; reconstructed the new live baseline `dpl_Err4jKzpFwJw7SPk1R9A4rVoZrg8` and confirmed the character-sheet source had not changed before applying this update. The release changes only `src/views/CharacterSheetView.vue`. All 311 dry-run source hashes match the reviewed manifest. Unrelated live and checkout work is preserved.

Published release: `dpl_Bf1qJas7g292MVTCvCCaorMtG8CU`, https://dndoldal-pelils8jx-dndenjoyerstudio.vercel.app, promoted to https://dndoldal.vercel.app. All 311 uploaded source hashes match the reviewed source; the alias still pointed to the reviewed baseline immediately before promotion. Staged/public health returned 200. Public assets include the XP eligibility check, synchronous save handling and retained party controls. Unauthenticated party access returned 401. Desktop/mobile protected-room redirects and login rendering passed without browser errors. No production character writes were made.

Rollback target: `dpl_Err4jKzpFwJw7SPk1R9A4rVoZrg8`. No database migration is involved.

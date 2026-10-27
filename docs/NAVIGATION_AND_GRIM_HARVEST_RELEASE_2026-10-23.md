# Navigation recovery and Grim Harvest — 23 October 2026

Released to https://dndoldal.vercel.app at approximately 09:20 UTC (11:20 Budapest).

- Published deployment: `dpl_JBfCg8Utta7WkMdfZQh2W9m2Q4Uz`, https://dndoldal-3znyziv01-dndenjoyerstudio.vercel.app.
- Previous deployment: `dpl_Bf1qJas7g292MVTCvCCaorMtG8CU`, https://dndoldal-pelils8jx-dndenjoyerstudio.vercel.app.
- Exact source, manifests, deployment records and verification: `.preview.local/navigation-grim-harvest-20261023/`.

Failed page-code downloads now show a recovery notice with Reload and continue and Keep working. Reloading preserves the destination and asks about unsaved work. Existing navigation guards remain in place; no automatic reload or mutation retry was added. Existing open tabs need one refresh to receive this handler.

Imported feature metadata now trims names during lookup, matching how reference keys are recorded. The live Blood Magic character stores `Grim Harvest ` with a trailing space and no explicit origin. Its matching subclass definition was present, but the inconsistent lookup prevented inferred subclass origin and gained level. The live sheet now displays Grim Harvest under Class combat features at level 3 without rewriting character data.

The release was reconstructed from the then-current live source, preserving all other deployed work. Exactly five application source files changed or were added: `src/App.vue`, `src/router/index.ts`, `src/composables/useSheetLibrary.ts`, `src/lib/navigation-recovery.ts`, and `src/components/ui/NavigationRecovery.vue`. All 313 uploaded source hashes match the reviewed manifest. The public alias still pointed to the baseline immediately before promotion.

Validation: isolated production frontend build and TypeScript passed; all 14 focused tests passed. Staged and public health returned JSON 200, and unauthenticated character access returned 401. Served assets contain both fixes. An authenticated, read-only browser check confirmed Grim Harvest appears in Class combat features with level 3; the complete character response was identical before and after that check.

The live browser also verified recovery-notice rendering, the unsaved-work confirmation, cancellation without navigation, dismissal, and normal navigation from Game rooms to Compendium. The download failure was simulated with a preload-error event; production assets were not removed or modified for testing.

Compendium-wide editing was assessed and deferred as requested. See [Compendium editing scope](COMPENDIUM_EDITING_SCOPE_2026-10-23.md). No compendium editor changes, character writes, data migrations, commits, or pushes were part of this release.

Rollback, if needed:

```powershell
npx.cmd --yes vercel@65.1.0 promote https://dndoldal-pelils8jx-dndenjoyerstudio.vercel.app --scope dndenjoyerstudio --yes
```

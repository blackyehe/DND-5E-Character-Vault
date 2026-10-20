# Folio refinements: published release

## Published on 20 October 2026

- Public site: https://dndoldal.vercel.app
- Application commit: **aa44424**, including the refinements from **ac33cdd**.
- Branch: `codex/folio-sheet-rollout`.
- Vercel deployment: `dpl_Af2JSsJL1GQTjrV98Z6rU8HVBgFn`.
- Deployment URL: https://dndoldal-m75v5o6ri-dndenjoyerstudio.vercel.app

The user explicitly authorized publication without another preview, conditional on retaining rollback. Vercel reported Ready, promotion succeeded, and inspection confirmed the main domain points to this deployment. This release supersedes the pending status in `FOLIO_REFINEMENTS_STAGE_RECORD_2026-10-20.md`.

Summary now includes every standard skill and modifier, with proficiency/expertise status. Long weapon proficiency lists use the existing consolidation rule in Summary, Proficiencies and Classic view. The compact statistics, full-width Combat vitals, zero-HP death saves and collapsible multi-column sections from `ac33cdd` are also live.

## Immediate rollback for everyone

Restore the deployment that was live immediately before this publication:

```powershell
vercel rollback dpl_6xEEVqQmcqw3dXLACrAoyyEUWiP7 --scope dndenjoyerstudio --yes
```

If the CLI is not globally installed, use the existing local installation:

```powershell
& 'C:\Users\PC\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'C:\Users\PC\AppData\Local\npm-cache\_npx\67eb4586ca667318\node_modules\vercel\dist\index.js' rollback dpl_6xEEVqQmcqw3dXLACrAoyyEUWiP7 --scope dndenjoyerstudio --yes
```

Alternatively, restore that deployment from the Vercel project dashboard. Confirm the domain afterward and reload open tabs. This returns to the first Folio release, application commit `46ccd37`, without rewinding current character or resource data.

## Git recovery

Checkpoint **pre-folio-refinements-2026-10-20** retains source at `22536d2`, the previous live application plus its documentation. To undo the application changes on the release branch, revert **aa44424** first, then **ac33cdd**. In GitHub Desktop use History → Revert Changes in Commit in that order, then deploy the reverted source. Reverting Git alone does not update the live website.

For an individual display fallback, **Appearance → Use Classic sheet** remains available; it is a personal layout choice rather than an application rollback.

## Publication checks and limits

- Frontend type checking and production build passed.
- The public home page and backend health endpoint returned HTTP 200; backend reported `ok: true`.
- The public entry asset matches the corrected local build (`index-C4DVyrgF.js`).
- The character-sheet bundle returned HTTP 200 and includes the all-skills heading.
- No automated test suite, database migration, character edits or resource writes were performed during publication.
- The rollback deployment is retained; rollback has not been executed.

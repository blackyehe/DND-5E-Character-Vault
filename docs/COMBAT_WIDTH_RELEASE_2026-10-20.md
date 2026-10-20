# Combat panel width correction — 20 October 2026

Published with the user's explicit authorization to https://dndoldal.vercel.app.

- Application commit: `8125fd4`, on `codex/folio-sheet-rollout`.
- Deployment: `dpl_pduE5JK61Wh5Fpb92NAwMLJ48kzg`.
- Deployment URL: https://dndoldal-kc8fr0nbo-dndenjoyerstudio.vercel.app

The older compact layout capped direct Combat panels at 1024px while the feature sections could span the full container. Combat now has a dedicated root class that removes this cap for its direct panels, aligning Vitals, Attacks, spell slots/resources, Spells and the feature sections. The rule is scoped to Combat and follows its available width in both layouts.

Frontend type checking and the production build passed. Vercel reported Ready and promotion succeeded. The public page, published stylesheet and backend health endpoint returned HTTP 200; the stylesheet contains the new alignment rule. No automated test suite or character/resource writes were performed.

## Revert this adjustment

The preceding live deployment is retained: `dpl_Af2JSsJL1GQTjrV98Z6rU8HVBgFn`.

For an immediate site rollback:

```powershell
vercel rollback dpl_Af2JSsJL1GQTjrV98Z6rU8HVBgFn --scope dndenjoyerstudio --yes
```

Alternatively, roll back to that deployment in the Vercel dashboard. The prior application state is also saved under Git tag `pre-combat-width-2026-10-20`. Revert commit `8125fd4` in GitHub Desktop and redeploy if restoring through source control. Application rollback does not rewind character data or play resources.

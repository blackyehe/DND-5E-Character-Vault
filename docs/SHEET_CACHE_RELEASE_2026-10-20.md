# Sheet caching, editor alignment and Compendium scrolling: live release

## Publication and authorization

- Public site: https://dndoldal.vercel.app
- Visual-fix commit: `ed9a77c`.
- Caching and timing-history commit: `529f0ba`.
- Branch: `codex/folio-sheet-rollout`.
- Published deployment: `dpl_7UGM4XjRtayHBiqjGjsYfdeofNBD`.
- Deployment URL: https://dndoldal-3cpim6s00-dndenjoyerstudio.vercel.app

Automatic approval review initially blocked promotion pending explicit approval of this caching release. The user then said “Go ahead and publish it”, conditional on a backup existing. The preceding deployment and Git checkpoints had already been retained. Promotion then succeeded, and inspection confirmed the public domain points to the new Ready deployment.

## Live checks

- Home page and backend health returned HTTP 200; backend reported `ok: true`.
- Public entry bundle: `index-fOJafYT9.js`.
- Editor navigation, content panel and save bar each measured **880px** wide, with the same left edge at the checked desktop viewport. Previously they were 1192px / 880px / 1192px.
- Compendium → Wish had a 502px detail viewport with 912px of content and `overflow-y: auto`. Scrolling changed the detail panel's scroll position to 410px. Selecting Shield reset it to 0px.
- The browser's captured error log was empty for the checked navigation.
- No production character/resource edits, database migrations or permission changes were performed.
- Frontend type checking and production build passed; 18 targeted checks passed before publication. See `SHEET_CACHE_AND_TIMINGS_2026-10-20.md` for their scope and cache limits.

## Post-release loading observations

Same character and owner view as the baseline: Volenta, 20 October 2026, in the signed-in in-app browser. The browser tab was recreated after the earlier tab was no longer available, so the first sample began with an empty client reference cache.

| Opened (Budapest) | Sheet | References | Reference source |
| --- | ---: | ---: | --- |
| 15:54:08 | 0.47 s | 15.53 s | Server; empty client cache, newly deployed backend |
| 15:54:37 | 0.47 s | 0.03 s | Reused; Dashboard → Volenta |
| 15:54:45 | 0.53 s | 0.02 s | Reused; Dashboard → Volenta |

The pre-change warm-session baseline was 0.46–0.63 seconds for the sheet and 0.49–1.10 seconds for references. The observed repeat reference phase is much shorter with reuse. Initial saved-sheet opening remains around half a second in these samples.

The first post-deployment server reference phase still took 15.53 seconds. This is consistent with the earlier documented slow cold-reference path, which the small pre-change warm baseline did not reproduce. It is not a controlled before/after cold-start comparison and does not establish a regression caused by the cache. Caching does not remove this first server wait; the saved sheet is usable while references load. Continue collecting comparable samples across play sessions, expiry, changed saved versions and cold starts before making broader performance claims.

The in-site **Loading status** history identifies Server/Reused for each opening and keeps the sheet and reference phases separate. It lasts only for the current browser session; these baseline/post-release observations are retained here in Git.

## Immediate rollback

The exact preceding deployment remains available: `dpl_pduE5JK61Wh5Fpb92NAwMLJ48kzg`.

```powershell
vercel rollback dpl_pduE5JK61Wh5Fpb92NAwMLJ48kzg --scope dndenjoyerstudio --yes
```

The existing local CLI can run the same rollback:

```powershell
& 'C:\Users\PC\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'C:\Users\PC\AppData\Local\npm-cache\_npx\67eb4586ca667318\node_modules\vercel\dist\index.js' rollback dpl_pduE5JK61Wh5Fpb92NAwMLJ48kzg --scope dndenjoyerstudio --yes
```

Alternatively, restore that deployment in the Vercel dashboard. This application rollback preserves current database characters and play state; it does not restore an older database snapshot.

## Source rollback

- `pre-editor-cache-2026-10-20` points to `95fd847`, before both changes.
- `pre-reference-cache-2026-10-20` points to `ed9a77c`, retaining the visual corrections without caching.
- To remove only caching and its timing UI, revert `529f0ba` in GitHub Desktop, then rebuild and deploy.
- To remove both changes, revert `529f0ba`, then `ed9a77c`, then rebuild and deploy.

A Git revert does not itself update Vercel. The deployment rollback is the quickest route back to the exact prior live application. Rollback was documented and retained, not executed.

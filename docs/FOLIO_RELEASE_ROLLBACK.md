# Folio release and rollback

## Before the release — 20 October 2026

The user approved publishing the reviewed Folio character sheet and requested easy rollback options.

- Site: https://dndoldal.vercel.app
- Vercel project/team: `dndenjoyerstudio/dndoldal`.
- Recorded previous production deployment: `dpl_3XdhdLLoWmFnuD3PbLGp9CPhiyDR`.
- Previous deployment URL: https://dndoldal-4q6xnw6e3-dndenjoyerstudio.vercel.app
- Git code baseline: `a9414ea`, preserved by the tag `pre-folio-2026-10-20`.
- Release work is saved on `codex/folio-sheet-rollout`.

The production deployment is the exact hosted rollback target. The Git tag records the repository baseline before the Folio changes; it is not a database backup.

## Quick personal fallback

Open **Appearance → Use Classic sheet**. This restores Classic layout and typography with Comfortable spacing on the current device. The chosen colour palette stays selected. Use the separate theme controls to change it.

This changes a personal display preference immediately. It does not roll back the application release or other players' preferences. The shared disclosure component remains part of the new application; use deployment rollback for the exact previous application.

## Restore the previous live application

In Vercel, open the `dndoldal` project, find the deployment above in **Deployments**, and use its rollback action.

Alternatively, with the Vercel CLI signed into the project team:

```powershell
vercel rollback dpl_3XdhdLLoWmFnuD3PbLGp9CPhiyDR --scope dndenjoyerstudio --yes
```

The existing CLI on this computer is also available without a global installation:

```powershell
& 'C:\Users\PC\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'C:\Users\PC\AppData\Local\npm-cache\_npx\67eb4586ca667318\node_modules\vercel\dist\index.js' rollback dpl_3XdhdLLoWmFnuD3PbLGp9CPhiyDR --scope dndenjoyerstudio --yes
```

Check that `dndoldal.vercel.app` points to that deployment once rollback completes. Reload open tabs so their JavaScript also returns to the older version.

Vercel rollback restores the deployed application, not historical character values. Current HP, items, accounts, rooms and homebrew remain in the existing database. This release introduces no database migration.

## Restore the source in Git

In GitHub Desktop, select this repository and the `codex/folio-sheet-rollout` branch. In **History**, locate **feat: ship Folio character sheets with Classic fallback** and choose **Revert Changes in Commit**. This creates a new commit that undoes the release while preserving history.

The `pre-folio-2026-10-20` tag can also be used to inspect the previous source. Avoid resetting or deleting later commits, as they may contain unrelated fine-tuning work.

Reverting a Git commit does not itself change Vercel: deploy the reverted source, or use the deployment rollback above for the immediate live fallback. This local repository currently has no Git remote configured.

## Publication procedure

Build a production-target deployment with automatic domain promotion disabled. Only promote it after Vercel reports Ready and the expected frontend assets are available. Keep the previous deployment intact.

The final release record below will capture the release commit and new deployment once publishing completes. No character/resource writes are required for publication checks.

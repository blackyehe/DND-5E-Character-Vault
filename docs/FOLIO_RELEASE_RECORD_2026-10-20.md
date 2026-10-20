# Folio production release — 20 October 2026

## Published version

- Public site: https://dndoldal.vercel.app
- Release branch: `codex/folio-sheet-rollout`.
- Release commit: `46ccd37` — **feat: ship Folio character sheets with Classic fallback**.
- Vercel deployment: `dpl_6xEEVqQmcqw3dXLACrAoyyEUWiP7`.
- Deployment URL: https://dndoldal-1ptesv1f0-dndenjoyerstudio.vercel.app
- Vercel project/team: `dndenjoyerstudio/dndoldal`.

The user approved publishing the reviewed character sheet with rollback options. It was built using production settings with domain promotion disabled, then promoted after Vercel reported Ready and the staged application displayed the new Appearance controls. The original production deployment was retained.

## Easy fallback during fine-tuning

For a personal display change, open **Appearance → Use Classic sheet**. This selects Classic layout, Classic typography and Comfortable spacing on the current device. It keeps the currently selected palette. Use **Use Folio preview style** to apply the light Folio reference style, or select layout, fonts and colours separately.

The Classic setting is a display fallback within the new application. To restore the exact earlier application for everyone, use deployment rollback.

## Restore the previous live deployment

Previous deployment: `dpl_3XdhdLLoWmFnuD3PbLGp9CPhiyDR`.

Previous deployment URL: https://dndoldal-4q6xnw6e3-dndenjoyerstudio.vercel.app

Use that deployment's rollback action in the Vercel project, or run:

```powershell
vercel rollback dpl_3XdhdLLoWmFnuD3PbLGp9CPhiyDR --scope dndenjoyerstudio --yes
```

The existing local CLI can also run it without a global installation:

```powershell
& 'C:\Users\PC\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'C:\Users\PC\AppData\Local\npm-cache\_npx\67eb4586ca667318\node_modules\vercel\dist\index.js' rollback dpl_3XdhdLLoWmFnuD3PbLGp9CPhiyDR --scope dndenjoyerstudio --yes
```

After rollback, confirm the main domain points to the previous deployment and reload open site tabs.

## Restore the source in Git

The baseline before Folio is `a9414ea`, preserved by the annotated tag **pre-folio-2026-10-20**. The original `master` branch remains at that baseline. The release is on **codex/folio-sheet-rollout**.

In GitHub Desktop, choose the release branch, open **History**, right-click commit **46ccd37**, and choose **Revert Changes in Commit**.

Equivalent command:

```powershell
git revert 46ccd37
```

Deploy the reverted source to restore production from Git. A Git revert alone does not update Vercel. Later fine-tuning to the same lines can require conflict resolution, so use the recorded Vercel deployment for an immediate application rollback.

This release record is a separate documentation commit, leaving the release commit itself straightforward to revert before subsequent code changes. The repository currently has no configured Git remote; these commits are available in the local repository and GitHub Desktop.

## Data and publication checks

This release contains presentation changes and local fonts. It introduces no database migration. No character/resource writes were made as part of publication checks. Rolling the application back preserves the database's current characters, items, resources, rooms and accounts; it does not rewind play state.

Completed checks:

- Frontend type check and production build passed.
- Vercel's upload list excluded private preview data, local secrets, backups and Git metadata.
- Vercel reported the production-target build Ready.
- The staged application rendered the Folio layout/font preferences and Classic fallback.
- After promotion, the public home page, entry script, stylesheet, a local font and `/api/health` returned HTTP 200.
- The public script contained both the Folio preset and **Use Classic sheet**; its stylesheet contained the Folio layout.

No automated test suite or production resource-write exercise was run. The rollback command is documented, not executed, so the approved new release remains live.

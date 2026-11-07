# Recovery checkpoints — 7 November 2026

Two distinct application states were preserved before disk cleanup. The working
checkout contains accumulated development changes; it is not identical to the
last documented production release. Creating these checkpoints does not deploy
either state or change campaign data.

## Post-cleanup checkpoint

- Branch: `codex/recovery-checkpoint-20261107`
- Annotated tag: `recovery/post-cleanup-20261107`
- Application source is unchanged from `recovery/working-state-20261107`.
- The completed cleanup removed only reviewed, ignored development artifacts.
  Its subsequent build/types, tests, retained-file checks and live read-only
  data comparisons pass.
- See [Workspace cleanup and preservation checks](audits/workspace-cleanup-2026-11-07.md)
  for the validation scope and recovery details. The two original recovery tags
  remain intact.

## Current working state

- Branch: `codex/recovery-checkpoint-20261107`
- Annotated tag: `recovery/working-state-20261107`
- Contains the current tracked and previously untracked source, tests, scripts,
  documentation and public research reports. Private files and generated local
  artifacts remain excluded by `.gitignore`.
- Production build, frontend types and backend types pass.
- Default test run: 1,066 passed, 67 skipped or opt-in, zero failed.
- Package manifests agree with their lockfiles. Secret-pattern findings were
  reviewed as synthetic fixture data or runtime environment references; no
  private environment values were detected in the checkpoint inputs.

Validation commands on Windows:

```powershell
npm.cmd run build
npm.cmd run server:typecheck
npm.cmd test -- --maxWorkers=2 --no-fsModuleCache
```

The database integration suites remain opt-in; this checkpoint does not claim a
fresh production, browser or full database integration acceptance pass.

## Last documented verified production release

- Branch: `codex/verified-release-checkpoint-20261107`
- Annotated tag: `recovery/verified-release-20261107`
- Archived release: `dpl_Kos3t4SFmhPRmNNfVAFFPcXVyBTh`, documented on 4 November
  in `docs/audits/sign-in-page-preparation-2026-11-04.md` and rechecked by the
  subsequent backend startup review.
- All 491 archived source/test inputs match the recorded SHA-1 manifest, before
  and after validation. The manifest accompanies the release checkpoint.
- A new isolated validation passes the production build, frontend/backend types
  and 297 tests, with two optional external-pack tests skipped and zero failed.

This records the last locally documented verified release. It does not assert a
new inspection of the current hosted aliases or publish the working checkout.

## Recovery procedure

First preserve any work created after this checkpoint and confirm the checkout
is clean. Fetch the remote references, then create a new branch from the desired
tag:

```powershell
git fetch origin --tags
git switch -c restore/working-state recovery/working-state-20261107
# Alternatively, restore the archived production source:
# git switch -c restore/verified-release recovery/verified-release-20261107
npm.cmd ci
npm.cmd --prefix server ci
```

Restore required private environment settings from the private backup, then run
the validation commands above. Use the release checkpoint's own README for its
test command. Code rollback does not restore database records or browser drafts.

## Files outside Git

A private recovery directory under `~/ProjectRecovery/dndoldal/` preserves the
pre-checkpoint Git history bundle and a compressed workspace archive. The archive
includes ignored release snapshots, campaign exports, backups, local environment
and editor settings, retained browser profiles and database fixture files.
Dependency folders, Git internals and generated `dist` folders are excluded;
directory links are recorded without following them. Verification and file
hashes are recorded alongside and inside the archive.

The archive is private and must not be committed. Its local copy is on the same
drive; retain a separate-drive copy before removing the original recovery data.
Raw database files in the archive do not replace an application/database export.

Some directories inside `.local` are registered Git worktrees. Their branches
and any uncommitted files must remain recoverable before a later cleanup removes
them. This checkpoint performs no disk cleanup.

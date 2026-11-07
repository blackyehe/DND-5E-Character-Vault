# Verified release recovery checkpoint

This branch preserves all 491 archived source/test inputs of release
`dpl_Kos3t4SFmhPRmNNfVAFFPcXVyBTh`, documented on 4 November 2026.
The archived inputs match `docs/recovery/source-manifest.json` byte for byte.
Git ignore rules and these recovery notes are additional repository metadata.

On 7 November the isolated package passed its production build, frontend and
backend types, and 297 tests. Two optional external-pack tests were skipped.
These checks do not assert a new hosted acceptance pass or publish anything.

The separate `recovery/working-state-20261107` tag preserves the accumulated
working checkout, including newer development work and its complete audit docs.
Do not confuse that broader working state with this archived production package.

## Restore and validate

Preserve subsequent work and start from a clean checkout.

```powershell
git fetch origin --tags
git switch -c restore/verified-release recovery/verified-release-20261107
npm.cmd ci
npm.cmd --prefix server ci
# Restore private environment settings from the private recovery backup.
npm.cmd run build
npm.cmd run server:typecheck
npm.cmd test -- --maxWorkers=2 --no-fsModuleCache
```

Code recovery does not restore campaign database records or browser drafts.
Retain private campaign exports and local settings separately from Git.

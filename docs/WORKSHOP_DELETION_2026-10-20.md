# Workshop deletion and recovery

## Request and scope

The user requested deletion controls for test creations in the Workshop and other sensible creation libraries. Previously, only individual draft rules and entire imported packs could be removed. Whole Workshop definitions, items, reusable actions and device drafts lacked deletion controls.

Visible Delete controls now sit beside creation cards in the class/subclass/race, item, monster and reusable-action libraries. Device drafts have a distinct Delete draft control. A confirmation explains the selected scope. A shared Recently deleted section restores account creations, individual pack definitions and device drafts.

Imported definitions without Workshop metadata and SRD content are not individually deleted by these controls. Existing whole-file management remains in Compendium → Homebrew files.

## Preservation and recovery

- Item and reusable-action records change to the inactive `deleted-content` type. Their original data and IDs remain stored. Account libraries no longer select them. Existing character equipment and copied monster actions are untouched.
- Individual native definitions are removed from active Orcbrew source, with their exact EDN key/value forms retained in the pack's top-level `workshopTrash` field. Source replacement and recovery metadata are written in the same compare-and-set update. Unrelated entry bytes are preserved. A harmless pack-ID comment prevents identical empty sources colliding with the existing unique source-hash index.
- Restore reuses the original map location and refuses to replace an occupied key. Source is parsed again before writes. Deletion checks the expected source hash; writes compare `updatedAt`. Record deletions compare revisions and writes compare `updatedAt`. All queries are owner scoped and authenticated.
- Existing class/race/subclass bindings continue using their saved rules when the source disappears. The existing missing-source review notice is used. Restoring the source clears that notice on the next resolved sheet read.
- Device drafts are saved in device recovery storage before removal from the active draft list. Restore refuses to overwrite another draft with the same identity.
- Recovery is not automatically purged. Limits are 200 device drafts, or 200 snapshots / 6 MB of recovery forms per pack. Deletion is refused before exceeding these limits. Keeping the original pack is required to recover its definitions. Removing that entire pack through the older Compendium control also removes its recovery snapshots.
- Complete account backups include record recovery metadata and pack snapshots. Workshop backup downloads also include deleted device drafts. Older application versions do not expose the recovery interface; recovery data remains stored for return to this version.

## Verification and rollout

No automated tests were requested, added or run. Frontend and backend type checks and the production build passed. Signed-in live review confirmed the Recently deleted endpoint loads without errors, saved class and item Delete controls appear, and draft/pack confirmations explain scope correctly. Both confirmations were cancelled; no production creation or draft was deleted or restored during verification. Production database mutation/recovery paths were reviewed in code but were not exercised against user content. No warnings or errors were captured in the browser during review.

- Application commit: `4da65fc`.
- Published deployment: `dpl_2Ebm6Rsd9ncdfhHayhyTaLPEsq8i`.
- Public domain: https://dndoldal.vercel.app/homebrew
- Deployment URL: https://dndoldal-32ywp6ryo-dndenjoyerstudio.vercel.app
- Vercel reported READY before promotion, and the public domain was verified against this ID afterward. `/api/health` returned `{"ok":true}`.
- Local screenshots: `.preview.local/workshop-delete-controls-live.png` and `.preview.local/workshop-delete-confirmation.png` (excluded from deployments).

The pre-change application deployment is `dpl_CZeMBtahKsw61yrRF1iCL2JzJbuF`; source checkpoint `008b22e`, tagged `pre-workshop-deletion-2026-10-20`. Rolling the application back preserves recovery data, but its interface requires this release or a later one. Rollback command:

```powershell
vercel rollback dpl_CZeMBtahKsw61yrRF1iCL2JzJbuF --scope dndenjoyerstudio --yes
```

Reverting Git commit `4da65fc` requires a new deployment to change the public application. No rollback was executed.

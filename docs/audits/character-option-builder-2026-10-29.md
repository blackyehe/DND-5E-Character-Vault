# Feat and background authoring — local implementation, 29 October 2026

The first functional option-builder stage is implemented locally. It creates feats and backgrounds, saves them into Orcbrew packs, retains selected identities through creation/editing, and supplies selected definitions to room players. No commit, push, deployment or production-data write was performed.

## User-visible behavior

- Homebrew Workshop has a **Feats & backgrounds** section. It reuses the existing guided entry form, including descriptions, prerequisites, background features/equipment notes, supported Benefits and review.
- **New feat/background** starts a device draft. Drafts survive reload, can be downloaded, and use the existing Recently deleted recovery flow. Corrupt draft data is preserved instead of silently overwritten. Storage failures keep the current work in memory and block navigation that would lose it.
- **Save to pack** creates a new pack or adds an option to a selected pack. Reopening an authored option edits its original pack. Saves validate the option and benefits, enforce ownership, check its revision and the target pack hash, and condition the write on the pack's saved version. Unrelated EDN forms and unsupported native fields are preserved.
- Authored options appear in the ordinary creator catalogs and Compendium. Existing imported options remain editable through the Compendium; this stage does not convert arbitrary imported options into native Workshop drafts.
- The creator stores a selected background ID and explicit feat-definition references. Source-qualified display labels no longer determine their identity. An unavailable selected feat remains in the draft and prevents completing creation until repaired or deselected.
- Editing adds a saved-background selector and retains the feat's definition reference. Re-adding an already selected feat is disabled, including an older alias of the same definition. Typing a custom background detaches the selected definition. Switching backgrounds preserves existing copied features and adds new feature text; the UI asks the user to review old features.
- Newly selected authored options capture supported grants from the owner's library. Later pack changes keep those values pinned until reviewed through the existing Compendium review/apply flow. Reselecting a newer index in the same native lineage does not silently replace approved grants. Review replaces the old snapshot instead of stacking both versions. Future acquired-level feat grants stay inactive until that level.
- An assigned player needs no imported library: only selected definitions and copied feature text cross the room boundary. Deleted sources retain last-reviewed rules and show an unavailable-source warning. Same-name options cannot replace one another merely because a label matches.
- Saved options are included in the server account backup. Device backup also includes option drafts, and draft trash restoration recognizes the owner-scoped option store. Saved feats/backgrounds can be removed and restored through supported pack trash operations.

The existing mutation event and authenticated revisions invalidate browsing/creation caches after saving. No separate cache mechanism was added. The owner sheet-reference projection version advances once so an older cached projection cannot hide new selection fields. Room responses remain outside persistent owner reference storage.

## Identity and compatibility

Native options use a UUID and authored revision under `:codex/option`. Their catalog index remains content-derived, consistent with imported content. Updated options retain up to 200 previous reference IDs, and the native UUID supplies lineage when reviewing or reselecting an updated definition. These additions apply to the new authored format; legacy pack fingerprints and rules are not rewritten.

Character persistence adds optional `meta.backgroundIndex` and versioned `features[].definition` references for feats. Existing records remain readable without a migration or reimport. Legacy recovery accepts an exact source-qualified label or an unambiguous plain label. An explicit missing ID is never replaced using its label. Ambiguous legacy data keeps saved text and needs explicit selection/repair.

The authoring gallery is lazy-loaded. Its direct compiled JavaScript chunk is 11,552 bytes / **4,374 gzip bytes**, with 266 gzip bytes of component CSS in this build. Those are the component's own assets, not its complete dependency graph or a comparison with the exact live release. The guided form reuses existing chunks. No startup or hosted loading-time improvement is claimed.

## Verification

- Frontend type checking and production build pass; server TypeScript checking passes.
- Final workspace suite: **625 passed, 55 skipped, zero failures**. New regressions cover source-qualified/ambiguous labels, renamed aliases, pinned grants, missing and same-name sources, deselection, acquired levels, safe pack editing, draft recovery and native trash restoration.
- Ten isolated MongoDB/API scenarios pass: author/reopen both types, creator-catalog availability, identity/grant persistence, selected-only player references, account boundaries, stale revisions/hashes, rename stability, review without duplicate bonuses, native trash recovery, deselection/revocation and backup inclusion. Several scenarios contain multiple assertions.
- Seven desktop Edge scenarios pass using the real compiled frontend and local API/MongoDB: device-draft reload recovery; author/save both types; reopen/revise; complete creator; selected background/duplicate-feat editor controls; empty-library player feature visibility; and no JavaScript/API errors.
- The browser fixture supplies small fictional standard Human/Fighter responses and synthetic accounts/content. Actual option, character, review, pack and room routes use a dedicated local MongoDB database. It never calls the public website. This is not hosted verification or an audit of the private 126-pack library.
- Local fixture databases and browser contexts were removed. Source snapshots, reports, screenshots, logs and fixtures remain ignored under `.local/option-builder-20261029/`.

Visual inspection caught an existing stylesheet dependency: `EntryBuilder` relied on CSS loaded by its former modal parent. The builder now imports its own styles so the standalone form has the intended spacing/navigation. The final desktop run was repeated against that build and passed.

## Remaining work and release limits

Invocations, boons, durable choice groups, languages/reference creation and subrace authoring remain separate stages. Prerequisites remain prose for table review. Equipment notes do not grant inventory automatically. Only existing supported Benefits are automated; missing rules/progression are not invented.

The previous feat/background identity-reference finding is addressed locally by explicit IDs and unambiguous legacy recovery. The unrelated biography/notes save omission, special-item validation failures and long creator name-field anomaly remain queued. The creator test enters the name early and does not claim to resolve that longer failing sequence.

Publishing still requires an exact live-source comparison/reconciled candidate, dependency/transfer measurements against that candidate, and hosted verification. The Git/live baseline discrepancy and unrelated dirty extension/editor/cache work remain preserved. This is a local feature implementation, not a release approval or completion of the whole option-builder plan.

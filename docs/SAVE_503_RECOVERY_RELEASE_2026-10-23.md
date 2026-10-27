# Notebook save recovery — 23 October 2026

Released to https://dndoldal.vercel.app at approximately 08:37 UTC (10:37 Budapest).

- Deployment: `dpl_EJqvJJsE3z8vV4ygSPxdNoYdDoqB`, https://dndoldal-k2hnq1f6k-dndenjoyerstudio.vercel.app.
- Previous deployment: `dpl_sojfggK4oq8SwWB2ipJ8GynhJV26`, https://dndoldal-8a54q1kdm-dndenjoyerstudio.vercel.app.
- Evidence and exact release source: `.preview.local/save-503-recovery-20261023/rebased/`.

## Change

Notebook writes can now recover from a cached transient `Model.init()` rejection. The readiness barrier first uses normal initialization. For a recognized network, server-selection, or pool-checkout failure, it retries the model's public, idempotent `createCollection()` and `ensureIndexes()` operations before starting the existing transaction. It requires both the notebook and history models to be ready. Successful readiness is shared across concurrent callers and cached; a failed attempt permits a later request to retry. Models are resolved lazily, preserving the previous route's lookup timing.

Permanent initialization errors still block writes. The recovery does not replay a save transaction, drop indexes, alter model internals, migrate documents, change revision checks, or weaken access control. Pool sizes, timeouts, hosting, and billing settings were not changed.

Pool-timeout and related connection errors now receive bounded, credential-redacted diagnostics. Failures distinguish notebook initialization from transaction execution and include operation duration, nested causes, and up to five stack frames per cause. Arbitrary application/validation errors do not receive these expanded details.

Exactly three production source files changed: `server/routes/notebook.ts`, `server/lib/database-error.ts`, and new `server/lib/model-initialization.ts`. The existing production error handler already calls the diagnostic helper. The main checkout also received that handler integration because its local version was older; the dirty main checkout was not deployed.

The baseline was refreshed after the contextual-editing/private-quest release advanced production during testing. The final patch preserves that newer release and all existing frontend, Maps, city, Party, notebook, permissions, and history code. All 311 uploaded source hashes matched the audited manifest. No commit or push was made.

## Validation

- Latest-baseline backend typecheck passed. The staged Vercel Services deployment completed its build and reached READY.
- All 48 focused tests across eight files passed. These cover real Mongoose cached initialization failures, repeated outages, concurrent readiness, permanent index errors, bounded/redacted diagnostics, notebook permissions, private quests/clues, revision conflicts, folders, tags, and source links.
- Tests were taken from the exact deployed feature baseline. Newer Events tests in the concurrently changing main checkout were excluded because that feature was not part of this production baseline. The initial model-capture issue found by the HTTP suite was corrected by retaining lazy model resolution, after which the unchanged baseline fixtures passed.
- Nine integration checks passed against a uniquely named disposable database on the existing local MongoDB replica set. They used real Mongoose 9.11.2 and the reconstructed Express application. The checks injected a real cached initialization rejection, recovered and created an entry, saved another revision, rejected a stale revision, enforced private-entry access and the unique history index, rolled back an update when history creation failed, recovered on the next save, and created/updated a private folder. Only the uniquely named test database was removed afterward.
- Staged health returned JSON 200 and unauthenticated notebook access returned 401 through the authenticated Vercel CLI's protection bypass. Direct unauthenticated access to the staged URL redirects to Vercel login; that HTML response was not treated as an application health result.
- The public alias was checked against the expected previous deployment immediately before promotion. After promotion it resolved to the intended READY deployment; public health returned JSON 200 and unauthenticated notebook access returned 401.

## Live verification without campaign edits

An authenticated PATCH targeted the entry whose saves previously failed, using `expectedRevision: 9007199254740991` (the maximum safe integer). Its actual revision was 1. This intentionally impossible revision prevents a content write while exercising initialization, the transaction, current access checks, and the conflict guard.

The request returned the expected **409 revision conflict**, rather than 503. Server-reported application time was approximately 148 ms. The entry's complete before/after detail response was identical. This verifies the live initialization/transaction path; successful content-changing saves were tested on the disposable replica set rather than on the campaign.

All **50** campaign entries were reread after promotion. Their complete detail responses matched the pre-release snapshots, including prose, cover data, sharing, revisions, tags, clues, and connections. The entire notebook listing also matched. Both assigned-character player previews still returned exactly two readable entries, remained read-only, and returned 404 for the private entry used in the probe. No campaign content or visibility changes were made.

The post-release runtime query is saved as `post-release-errors.jsonl`. This short observation window does not establish long-term reliability. The original cause of the initial database/network disturbance remains unconfirmed; the known persistent-initialization defect is repaired, and recurring connection failures now have better diagnostics. See the [investigation](SAVE_503_INVESTIGATION_2026-10-23.md) for the preceding evidence.

## Rollback

If necessary, promote the previous deployment using the authenticated CLI:

```powershell
npx.cmd --yes vercel@65.1.0 promote https://dndoldal-8a54q1kdm-dndenjoyerstudio.vercel.app --scope dndenjoyerstudio --yes
```

Rollback changes code only; no data migration needs reversing. It also restores the previous cached-initialization failure behavior. Future releases must retain the new helper, route readiness wrapper, and diagnostics when reconstructing production source.

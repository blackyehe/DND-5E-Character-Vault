# Save HTTP 503 investigation — 23 October 2026

Follow-up: the targeted recovery and diagnostic patch was released later the same morning. See [Notebook save recovery release](SAVE_503_RECOVERY_RELEASE_2026-10-23.md) for implementation, verification, and rollback details. The findings below describe the pre-repair incident.

## Finding

The current failures are application-generated HTTP 503 responses carrying `MongoWaitQueueTimeoutError`. There is no reported provider incident affecting the application's Frankfurt region. A reproducible application defect can preserve a transient initialization failure indefinitely within an affected backend instance. This is the leading explanation for the very fast repeated save failures, although the live initialization stage has not yet been captured.

Waiting may help if the original connection problem clears and requests reach a healthy/new instance. It does not repair a cached rejected initialization promise on an existing instance. A restart previously restored saves, but errors subsequently returned on other deployments. Treat a restart as temporary mitigation rather than a permanent repair.

This investigation made no production writes, deployments, restarts, configuration changes, or changes to application source. It used authenticated read requests, Vercel read APIs/logs, official provider documentation, and an isolated local reproduction.

## Current production evidence

Inspected deployment: `dpl_Aq4gz63cPu3zwH79uwUN77UkUHzr`, `dndoldal-du719bwad-dndenjoyerstudio.vercel.app`, READY in `fra1`. Downloaded eight relevant deployed source files; each SHA1 matches the deployment's file manifest. The dirty main checkout differs from production, so it was not treated as the live implementation.

Three PATCH requests to the same notebook entry failed:

| UTC | Budapest | HTTP | Logged error | Request timestamp to error timestamp |
| --- | --- | --- | --- | --- |
| 08:00:58 | 10:00:58 | 503 | MongoWaitQueueTimeoutError | 67 ms |
| 08:01:18 | 10:01:18 | 503 | MongoWaitQueueTimeoutError | 53 ms |
| 08:03:43 | 10:03:43 | 503 | MongoWaitQueueTimeoutError | 140 ms |

These intervals are calculated from matching request IDs across Vercel request/runtime records; they are not a dedicated application duration measurement. Nevertheless, they are much shorter than the configured `waitQueueTimeoutMS: 8000`. Replaying an old rejected promise explains this pattern; a new eight-second pool checkout on each request does not.

Runtime error query covered 07:23:44–08:08:44 UTC and returned the three errors plus three Mongoose deprecation warnings. A separate current-deployment runtime query covered 07:26:14–08:11:14 UTC with the same six records. Both queries completed with no further pages or excluded intervals.

Project-wide HTTP 500+ request history covered 22 October 21:09–23 October 08:09 UTC. It returned six requests: the three above and three previously documented notebook-folder failures on 22 October. No pagination or excluded intervals. A wider request query was rejected because CDN history older than twelve hours requires a paid entitlement; it was narrowed successfully. Older runtime details remain unavailable under Hobby retention.

Authenticated live reads during this investigation succeeded:

- `/api/auth/me`: 200, application time approximately 4 ms.
- Notebook listing: 200, application time approximately 16 ms.
- Detail of the entry whose saves failed: 200, application time approximately 11 ms.
- `/api/health`: 200, but this endpoint runs before database middleware and only establishes application liveness.

The error handler returns a generic 503 for unhandled exceptions, so the status alone does not diagnose a provider outage. In these requests the logs establish a MongoDB driver error. The `new`/`returnDocument` deprecation warning is separate and does not explain these failures.

## Provider status and limits

At the investigation's status check, [Vercel](https://www.vercel-status.com/) and [MongoDB Cloud](https://status.mongodb.com/) reported operational components and no incidents on 22–23 October. MongoDB retains an unrelated monitoring incident for AWS `me-central-1`/`me-south-1`. Its resolved 20 October connectivity incident concerned GCP `europe-west2-b`, not this deployment's documented Frankfurt setup. Public status pages cannot rule out an individual cluster, network, or account issue.

The documented database tier is Atlas Free. Its [limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/) include 500 connections, 100 operations per second, 0.5 GB storage, and rolling seven-day transfer quotas. Exceeding throughput/transfer limits can introduce throttling. This investigation did not retrieve Atlas connection, storage, operations, or transfer metrics, so quota exhaustion is a possibility to check rather than an established cause. There is no evidence here that an upgrade is necessary.

## Reproduced initialization defect

Production uses Mongoose **9.11.2**, MongoDB Node driver **7.7.0**. The same Mongoose version is installed locally.

In `server/routes/notebook.ts`, the transaction wrapper awaits:

```ts
initialized ??= Promise.all([Notebook.init(), NotebookRevision.init()])
  .catch(error => { initialized = undefined; throw error })
await initialized
return mongoose.connection.transaction(fn)
```

[Mongoose's exact deployed source](https://github.com/Automattic/mongoose/blob/9.11.2/lib/model.js) returns the existing model `$init` promise whenever it exists. Rejection does not clear it. Resetting the route variable therefore does not cause a fresh model initialization attempt. Mongoose starts initialization automatically when models are compiled, so the original failure may precede the first visible save request.

The isolated reproduction injects a transient failure into collection initialization, restores the simulated connection, and calls the original route gate three times. All attempts receive the identical old error; no new collection/index attempt occurs. It uses real Mongoose 9.11.2, simulated storage operations, and no database/network access.

The proposed public-API recovery then succeeds, including after another simulated outage. Concurrent callers share initialization; subsequent calls reuse success. A permanent initialization error is propagated rather than retried as transient.

Run:

```powershell
node .preview.local/save-503-investigation-20261023/reproduce-init-cache.mjs
```

This confirms the code defect and a recovery mechanism. It does **not** prove that today's production exception came from `Model.init()`: current logs have neither an initialization stage nor a stack for this error type. A short stack or stage diagnostic is needed to close that causal gap. The original pool/network problem also remains unidentified.

## Recommended fixes, in order

1. **Add focused diagnostics.** Include `MongoWaitQueueTimeoutError` and relevant pool errors in the existing credential-redacted diagnostic helper. Record whether failure occurred during notebook initialization, transaction execution, or response generation. Record initialization attempt duration and a bounded sanitized stack; optionally aggregate pool checkout failures and pool-clear events. Keep document/query content out of logs. The current helper excludes the exact error being reported, and `stage` is undefined after the rate limiter completes.

2. **Recover failed notebook initialization.** Preserve the healthy `Model.init()` path. If it rejects with a recognized transient connection/pool error, retry the idempotent public `createCollection()` and `ensureIndexes()` operations for that model outside the transaction. Cache successful initialization and clear the route promise after failure so a later request can retry. Both notebook and history models must be ready before running the existing transaction. No private `$init` mutation, index dropping, `syncIndexes()`, document migration, or change to permissions/revisions is needed. Notebook models have no search indexes requiring another initialization step. The local reproduction validates this approach; a production implementation still needs route regression tests and disposable database validation.

3. **Harden connection lifecycle after measuring it.** Production has `maxPoolSize: 10`, `minPoolSize: 0`, and no `maxIdleTimeMS`. [MongoDB recommends idle connection expiry for serverless workloads](https://www.mongodb.com/docs/atlas/manage-connections-aws-lambda/). Evaluate `maxIdleTimeMS: 60000`, and evaluate Vercel's [supported MongoDB pool lifecycle hook](https://vercel.com/kb/guide/efficiently-manage-database-connection-pools-with-fluid-compute) if this Services backend uses the applicable Fluid lifecycle. These are preventive options, not proven repairs for this incident. Do not indiscriminately raise pool size: the limit applies to each pool in each instance, and Atlas has a total connection ceiling. Longer wait timeouts cannot repair an already cached rejection.

Do not remove the initialization/index barrier or transactional revision history to make saves pass. Do not add blanket browser retries to mutations whose commit outcome could be uncertain. A production patch should be reconstructed from the then-current deployed source to preserve other ongoing Maps, city, Party, and notebook work.

## Evidence

Sanitized findings, deployment source hashes, provider snapshots, log-query summaries, and reproduction output are under `.preview.local/save-503-investigation-20261023/`. `findings.json` is the compact index. The earlier chronology remains in [Notebook saving recovery](NOTEBOOK_SAVING_RECOVERY_2026-10-22.md).

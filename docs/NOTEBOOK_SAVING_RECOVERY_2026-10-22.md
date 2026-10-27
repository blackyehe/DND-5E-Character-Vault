# Notebook saving recovery — 22 October 2026

Saving recovered after a fresh production deployment restarted the backend. Before recovery, notebook reads succeeded but every attempted entry/folder write returned HTTP 503, with `MongoNetworkError` in the logs. The original connection failure cleared before its nested cause could be captured; a permanent root-cause fix has not been established.

## Production deployment

- Current: `dpl_DHWHwNH2W8bVkzwYsHDrkYJtKpLC`, `https://dndoldal-msjwyrkop-dndenjoyerstudio.vercel.app`.
- Public alias: https://dndoldal.vercel.app.
- Previous: `dpl_CFJdFLoYZy5vdC7qvkJ7qfjEwYjK`.
- Isolated source: `.preview.local/notebook-saving-repair-20261022/source/`.

The release was reconstructed from the exact 302-file live Campaign Codex source. Only `server/app.ts`, `server/middleware/request-limit.ts`, and new `server/lib/database-error.ts` changed. The added diagnostics identify failures in the shared database rate limiter and record nested connection errors with database credentials and JWT secrets redacted. Queries and documents are not logged. Authentication, rate limiting, transactions, revisions, permissions, frontend behavior, Maps and Party dashboard were preserved. The dirty main checkout was not deployed or reset.

All 303 uploaded source hashes matched the intended manifest. Backend typechecking, two diagnostic regression tests, and the Vercel frontend build/typecheck passed. Staged health returned 200. The public alias was checked for concurrent releases before promotion. After promotion, an empty draft passed the database-backed limiter and returned the expected validation error (400); the actual Magellan draft then saved (201) and matched on read-back. Subsequent folder creation, place creation and revision writes also succeeded. The post-recovery log query for `API request failed` returned no records through 20:54 UTC. Existing Mongoose deprecation warnings about `new` remain unrelated to these successful saves.

## Completed campaign import

Created nine Hungarian, DM-only Places entries from the active Revalon Obsidian vault and the recorded events through Session 12:

| Place | Entry ID |
| --- | --- |
| Magellan | `6ada778092c51262b57ca37c` |
| Willow | `6ada77b292c51262b57ca37e` |
| Birdsong | `6ada77b292c51262b57ca380` |
| Altseid | `6ada77b292c51262b57ca384` |
| Roche-Noir — a Vörös hegy | `6ada77b292c51262b57ca386` |
| Circle of the Land druida liget | `6ada77b292c51262b57ca388` |
| Truuselar | `6ada77b392c51262b57ca38a` |
| A Holdleány kolostora — Selûne szentélye | `6ada77b392c51262b57ca38e` |
| Amdurun | `6ada77b392c51262b57ca390` |

The list includes seven settlements and two other visited locations. Existing people, objects, groups and sessions were connected without changing their prose or stored revisions. Adjacent entries in the recorded travel sequence are linked, with an explicit Hungarian explanation that these links describe travel order and do not assert geographic adjacency. Created DM-only Altseid and Selûne szentélye folders under their existing country folders. Each new entry has a creation revision and a second revision adding travel connections.

Verification found 48 total entries and 9 Places, with no duplicates. All original 39 entries retained their exact body SHA-256, title, folder, permissions, character associations, outgoing links, revision and updated timestamp. Every new entry's complete body, relationships, type and history matched the import plan. Fade and Volenta previews still returned only the pre-existing shared book, exposed zero new places, and rejected private place detail requests with 404. The refreshed UI displays Places 9 and retains Maps and Party dashboard.

Import evidence is in `backups/revalon-places-2026-10-22/IMPORT_COMPLETE.json`; it supersedes the historical pending-import records. No session 13 outcomes were inferred or imported.

## Follow-up evidence — 21:57 UTC

The public alias now serves `dpl_3ahivW3KCmEZ4JWX6zTjjAR7WYVv`. Its deployed source retains the connection diagnostic helper and error-handler call. The current deployment logged three notebook folder POST failures at 21:44:48.997, 21:45:09.554 and 21:45:56.996 UTC, each with `MongoWaitQueueTimeoutError`; matching request records confirm HTTP 503. Both earlier monitored deployments returned zero matching API errors during the overlapping 45-minute window. All queries completed without pagination or excluded intervals.

This confirms that these three operations failed to obtain a connection from the MongoDB pool. It does not establish why a connection was unavailable or prove the same cause produced the earlier `MongoNetworkError` incident. The deployed options remain `maxPoolSize: 10` and `waitQueueTimeoutMS: 8000`. The diagnostic helper currently omits `MongoWaitQueueTimeoutError`, so it logged no message/cause details for these errors. `stage` was undefined, rather than `request-limit`.

Source review also identified a possible persistence mechanism requiring runtime confirmation: notebook writes await `Notebook.init()` and `NotebookRevision.init()`, while Mongoose returns its existing model `$init` promise, including after rejection. Resetting the route's local initialization promise alone does not clear that model-level promise. An initialization-stage trace would be needed to link this behavior to a production failure; it is not a confirmed incident cause.

The same deployment subsequently returned 200 for an entry PATCH at 21:45:46 UTC, 201 for a folder POST at 21:46:20, and 201 for an entry POST at 21:46:30. These are observed application requests, not monitoring writes. No evidence of existing-data corruption was obtained. No production writes, restart, deployment, or other-thread messages were performed by this monitoring run. Sanitized evidence and the inspected source files are in `.preview.local/notebook-saving-repair-20261022/evidence-2157/`. Monitoring remains enabled because the original root cause is still unconfirmed.

## Follow-up coverage limitation — 23 October, 07:47 UTC

The public alias resolves to READY deployment `dpl_BJFvzh5NtHmHmGcnxktWmTxZ44Dk`. Its source still includes and calls the diagnostic helper; the pool-timeout error type remains outside that helper's allowlist. Current-deployment and project-wide production runtime queries over the last 45 minutes returned zero `API request failed` messages, with no pagination or excluded intervals.

The last recorded review ended at 21:56 UTC on 22 October. Attempting to retrieve runtime logs since 21:45 UTC returned an explicit 400 retention error: “The hobby plan does not retain runtime logs for the requested time range.” Therefore the intervening runtime-log window could not be reconstructed. Project-wide production request history for that full interval remained available; its only HTTP 500-or-higher records were the two already documented folder failures after 21:45 UTC. It showed no additional server-error requests since the previous review. Missing historical runtime details still prevent a complete causal audit.

An initial helper 403 cleared after the existing authenticated CLI refreshed access, so current monitoring is operational. No credentials were requested or displayed. Two queued monitoring prompts were handled in one review. Evidence: `.preview.local/notebook-saving-repair-20261022/evidence-20261023-0747.json`. The original cause remains unconfirmed and the schedule remains enabled. This review made no production mutations.

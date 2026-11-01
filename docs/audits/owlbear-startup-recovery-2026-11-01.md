# Owlbear initialization availability — 1 November 2026

The user authorized publishing safe pending work and continuing the next task. This investigation is separate from the unfinished remembered-login feature. It does not change the approved trial room, epoch, grants, connection duration, session permissions or website authentication.

## Published map recovery and diagnostics

The original map candidate consistently failed its Owlbear gate with 503 at `pairing-indexes`, while the live Compendium baseline returned the expected 403/401. A fresh exact-source deployment containing the same map change and safer fixed diagnostic categories passes that boundary and all release checks. It is published as `dpl_3TBrHnbQdE4jQgLX6DQFbZYYxNew`, immutable `https://dndoldal-2zly1y4ns-dndenjoyerstudio.vercel.app`. Rollback is `dpl_FzBdyV5yuKkPYKwyXRJyxAyQ7s59`.

The deployed diagnostic reads own data properties only and emits allowlisted error kinds and fixed failure categories, never raw messages, stack traces, credentials or campaign content. Privacy/getter tests pass. The release passes 702 tests with 48 existing skips, backend types, the hosted build, exact source audit and hosted/public character, map, player, rules and origin/session boundary checks. Synthetic fixtures are cleaned; map quotas return to their initial values. See [the map release evidence](map-opening-recovery-2026-11-01.md).

This healthy fresh deployment is not proof that the intermittent initialization fault has been repaired. The failed candidate's existing diagnostic cannot identify the underlying error beyond its stage. No production pairing/session data was modified to force a failure or recovery.

## Reproduced cached initialization failure

The installed Mongoose implementation stores `Model.init()` in a model-level promise, including a rejection. The extension's current dispatcher retries loading its boundary after failure, but calls the same rejected model initialization again. An isolated replay uses real Mongoose initialization and the actual HTTP dispatcher, with simulated storage setup operations and no database or production access.

After a synthetic `MongoWaitQueueTimeoutError`, the unchanged reader returns 503 on the first request and continues returning 503 after storage recovers. Using the existing website `recoverableModelInitialization` helper repeats idempotent collection/index setup for recognized transient failures. In the replay it remains 503 while storage is unavailable, then reaches the ordinary 401 authentication barrier after storage recovers. A permanent duplicate-index error (11000) remains 503 and does not enter manual recovery or load the boundary.

This establishes a real recovery gap capable of making a temporary failure sticky. It does not establish that this particular error caused the earlier deployed 503. Integration into the extension's pairing/session readiness barrier is the next narrow change. All required indexes must succeed before routes are served; permissions and permanent errors must remain denied.

Ignored evidence: `.local/owlbear-initialization-20261101/`, including exact source, build/source audit, review and public checks, controlled cached-init replay, sanitized diagnostic results and cleanup evidence. The original map candidate's failure evidence remains under `.local/map-recovery-20261101/`.

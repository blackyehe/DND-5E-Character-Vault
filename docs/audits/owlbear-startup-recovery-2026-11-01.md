# Owlbear initialization availability — 1 November 2026

The user authorized publishing safe pending work and continuing the next task. This investigation is separate from the unfinished remembered-login feature. It does not change the approved trial room, epoch, grants, connection duration, session permissions or website authentication.

## Published map recovery and diagnostics

The original map candidate consistently failed its Owlbear gate with 503 at `pairing-indexes`, while the live Compendium baseline returned the expected 403/401. A fresh exact-source deployment containing the same map change and safer fixed diagnostic categories passes that boundary and all release checks. It is published as `dpl_3TBrHnbQdE4jQgLX6DQFbZYYxNew`, immutable `https://dndoldal-2zly1y4ns-dndenjoyerstudio.vercel.app`. Rollback is `dpl_FzBdyV5yuKkPYKwyXRJyxAyQ7s59`.

The deployed diagnostic reads own data properties only and emits allowlisted error kinds and fixed failure categories, never raw messages, stack traces, credentials or campaign content. Privacy/getter tests pass. The release passes 702 tests with 48 existing skips, backend types, the hosted build, exact source audit and hosted/public character, map, player, rules and origin/session boundary checks. Synthetic fixtures are cleaned; map quotas return to their initial values. See [the map release evidence](map-opening-recovery-2026-11-01.md).

This healthy fresh deployment is not proof that the intermittent initialization fault has been repaired. The failed candidate's existing diagnostic cannot identify the underlying error beyond its stage. No production pairing/session data was modified to force a failure or recovery.

## Reproduced cached initialization failure

The installed Mongoose implementation stores `Model.init()` in a model-level promise, including a rejection. The extension's current dispatcher retries loading its boundary after failure, but calls the same rejected model initialization again. An isolated replay uses real Mongoose initialization and the actual HTTP dispatcher, with simulated storage setup operations and no database or production access.

After a synthetic `MongoWaitQueueTimeoutError`, the unchanged reader returns 503 on the first request and continues returning 503 after storage recovers. Using the existing website `recoverableModelInitialization` helper repeats idempotent collection/index setup for recognized transient failures. In the replay it remains 503 while storage is unavailable, then reaches the ordinary 401 authentication barrier after storage recovers. A permanent duplicate-index error (11000) remains 503 and does not enter manual recovery or load the boundary.

This establishes a real recovery gap capable of making a temporary failure sticky. It does not establish that this particular error caused the earlier deployed 503.

## Narrow readiness change

The extension now obtains its pairing/session readiness barrier from a small `extensionModelReadiness` factory, using the existing website helper independently for each model. Concurrent requests share readiness work. A recognized transient initialization rejection can repeat idempotent collection/index setup; a later request can recover if that setup also temporarily failed. Successful readiness remains cached. No pairing, session or play update is replayed.

Both models and all required indexes must succeed before routes are served. Permanent errors, including permission failures, conflicting index definitions and duplicate-key failures, remain denied. Stage-specific diagnostics are retained. Trial scope, epoch checks, origin checks, token validation, session duration and every route's permission logic are unchanged. The remembered-login prototype is excluded.

The runtime scope is two files: `server/extension/api.ts` and new `server/extension/model-readiness.ts`. The scoped API diff consists of the readiness import, factory creation and replacing its previous two-model initialization call. The new factory does not change the generic helper shared by the rest of the website.

Validation passes 710 standard tests (48 existing skips), including eight focused readiness cases and 24 focused readiness/dispatcher/diagnostic/helper cases combined. Backend type checking passes. A separate MongoDB replica-set fixture on loopback port 27038 runs all 44 existing extension lifecycle tests with play controls enabled and the ordinary website server connected to the same isolated database. Pairing, invalid proofs, expiry, revoked access, HP, slots, resources, equipment and other allowed updates pass, including ordinary website reads after extension writes. The isolated database is dropped and its MongoDB/helper processes are stopped. No production database or account is used in this run.

Reviewed readiness candidate: `dpl_61xCxd5qpVG7HAEtLq8UDzgwspTw`, immutable `https://dndoldal-1cw588kxy-dndenjoyerstudio.vercel.app`. Its frozen package has 414 files. Baseline and rollback is the map-plus-diagnostics deployment above. Hosted/public gates pass and this readiness change is now live. Forced transient/permanent failures are exercised locally; do not force them against production storage.

Ignored evidence: `.local/owlbear-initialization-20261101/`, including the map/diagnostic release, controlled cached-init replay and sanitized diagnostic results; `.local/owlbear-startup-release-20261101/` contains readiness source/scope, validation, isolated lifecycle run and cleanup, plus the subsequent hosted/public release records. The original map candidate's failure evidence remains under `.local/map-recovery-20261101/`.

## Published readiness release

Published at 2026-11-01T09:54:10.637Z. The public alias is verified on `dpl_61xCxd5qpVG7HAEtLq8UDzgwspTw`. All 414 frozen source files match the deployed source audit. Eleven hosted character/editor/player checks, seven hosted map checks, ten standard-rule/desktop checks and the protected API/Owlbear gate pass. Immediate public HTTP/security, origin/session, standard-rule/desktop and seven map owner/player/recovery/revocation checks pass; synthetic cleanup and quota restoration are verified. No rollback was needed. The preceding map-plus-diagnostics deployment remains the rollback target.

The scoped source and tests are retained in the isolated verified website branch. Only the readiness import/factory/call were merged back into the original dirty extension API; its separate remembered-login prototype was preserved and excluded from both deployments. The generic website readiness helper is unchanged. A recognized transient setup failure can now recover on a subsequent request after storage recovers. This does not guarantee that all 503 causes recover, or prove the original incident was caused by the simulated timeout.

# Adaptive map opening: published and verified

Sir, adaptive map opening is live at https://dndoldal.vercel.app. The existing campaign map now has its two overviews; no original image, map title, sharing, content revision, timestamp, pin or region was changed.

## Released scope

- Final deployment: `dpl_BY1GPpWJLCYAdJFKJSSjQXwWLhFU`, immutable https://dndoldal-dihf2h712-dndenjoyerstudio.vercel.app.
- Initial adaptive-viewer deployment: `dpl_EK5ixrbTVtHSvLbjteAZhusRCwG6`, immutable https://dndoldal-mkphp2xgs-dndenjoyerstudio.vercel.app.
- Compatible rollback: `dpl_BKx7UzUFm4dzx6iNd4f4CHHFSf92`, immutable https://dndoldal-rc48v1sdb-dndenjoyerstudio.vercel.app. It retains derivative storage accounting while displaying the original image through the prior UI.
- Pre-change production: `dpl_ExfrJQJhALMYa3EJyB6Wd8MupCFf`. Do not restore this old accounting backend while any derivative-bearing map exists.

The release was reconstructed from the exact 423-file production source, then overlaid only with the [map prototype](map-overview-prototype-2026-11-02.md) and its five test files. Its 433-file hosted source tree was audited by SHA-1 against the frozen manifest. The earlier held `large-transfer.ts` response patch was explicitly excluded. Other unfinished Workshop, Compendium, notebook and remembered-connection work did not enter this release.

The final follow-up changes only `server/routes/room-maps.ts` relative to the reviewed adaptive deployment. It adds `POST /api/rooms/:roomId/maps/:mapId/prepare` behind the existing authenticated DM/write guards, strict expected-revision body and transaction initialization. This invokes the already tested idempotent backfill. A player, DM player preview, stale revision or extra body fields cannot invoke it. This permits an owner to prepare an existing map without local database credentials or a broader administrative grant.

## Validation

- The prototype's ordinary suite: 916 passed, 67 existing conditional skips. Frozen release tests: all 41 focused map tests pass; isolated frontend build and backend types pass.
- The actual local application/database checks were expanded to 73 passing checks, including the preparation endpoint's player/outsider/DM/conflict gates. A fresh loopback replica set was removed and its processes stopped afterwards.
- Eight local rendered Edge scenarios pass, with no page errors or browser writes.
- Hosted review and public checks verify original/overview dimensions and bytes, private cache headers, distinct owner/player/preview validators, fresh denial after sharing revocation, stale-write rejection, actual DPR 1/2 viewing, original hash on zoom, neighboring authentication/Workshop/extension boundaries and fixture cleanup/quota restoration.
- The compatible rollback was tested by uploading and deleting a derivative-bearing synthetic map without losing storage accounting.
- A legacy synthetic map was uploaded through the pre-change immutable deployment, prepared through the final candidate, and deleted through the accounting-aware backend. Its original hash, content revision, timestamps, pins/regions, repeat-preparation accounting and access boundaries all pass.

The first immediate public verification returned a 200 where a conditional 304 was expected, so the compatible rollback was used. The same HTTP checks subsequently passed on the settled compatible backend, with no application-code change. The adaptive candidate was promoted again after confirming public frontend version readiness, and all public gates passed. The preparation-route rollout also briefly returned 404 on an immediate repeat; later idempotent preparation and full verification passed. Deployment propagation is a possible explanation, not an established root cause. These transient observations were not counted as passing tests or discarded performance samples.

## Existing real map

The authenticated DM session was used to back up the original WebP and current map metadata/storage state into the ignored local evidence directory before preparation. The original remains 2,776,932 bytes with SHA-256 `db9192c42b2d1e30319d1135376982ca13e2f6ccc40c45037089093e684b42c3`.

The 1,024 overview is 178,808 bytes and the 2,048 overview is 703,264 bytes. Extra accounted storage is 882,072 bytes. Room and owner quota increases match that exact amount; all three quota reservations occur in the tested transaction. Repeating preparation returns `ready` without another reservation. Both variants and their authorized 304s were read successfully, and the original was downloaded again and hash-verified after preparation. Metadata, pins and regions match the pre-preparation snapshot.

A real owner browser with a fresh browser cache/context opened the 1,024-pixel fitted view in 172 ms, with its metadata popup visible at 108 ms. Reopening the retained selected image took 149 ms. No browser exceptions or mutation requests occurred in those UI observations. Origin/instance caches were not cleared. These are two observations after verification had already exercised the endpoint, not a paired production before/after study or proof that every former eight-second wait is eliminated.

Ignored evidence: `.local/map-overview-release-20261102/`, including frozen sources/manifests, deployment audits, initial and retry promotion/rollback records, hosted/public checks, preparation authorization checks, private image/metadata backups and `real-map-applied.json`. Secrets, image contents and campaign note text were not logged or committed. The broader Workshop work remains separate from the map deployments above.

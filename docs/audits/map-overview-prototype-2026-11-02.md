# Adaptive map overview prototype

Subsequent release: [published map overview verification](map-overview-release-2026-11-02.md) records the isolated production deployment and preparation of the existing map. The local-only statements below describe the prototype checkpoint before that publication.

Sir, the selected prototype is implemented locally. It opens the popup after authorized metadata arrives, loads a screen-appropriate overview, and upgrades detail as zoom demands. The original image remains byte-identical. Production and the real campaign database have not been changed.

This follows the [alternatives investigation](map-options-exploration-2026-11-02.md). It is a local implementation and validation result, not acceptance of a hosted performance improvement or promotion of the earlier held response patch.

## Behavior

- New uploads generate at most two WebP overviews: 1,024 and 2,048 pixels on the long edge. A variant is omitted when the source is already smaller or the result saves less than 20% of the original bytes. Generation is sequential and bounded, uses the existing Sharp dependency, and never occurs on an image GET.
- The original image endpoint and original byte count remain available. Variant metadata accompanies the map index/detail; image bytes remain in the separate asset document and never enter a map index or notebook document.
- Initial image selection uses conservative screen dimensions and DPR, while details and the chosen image start concurrently. After mounting, the actual canvas scale/DPR determines whether more pixels are needed. No original download starts merely because an overview has finished.
- The popup opens as soon as its authorized metadata arrives, with loading progress when Content-Length is available. Notebook picker requests wait for the first decoded image so the earlier popup does not add them to the initial image's critical path.
- Zoom upgrades are debounced, load only a higher resolution, and decode offscreen before replacing the current URL. The existing image remains usable during an upgrade and after a transient upgrade failure; Retry detail is explicit. Moving back to a resolution already available clears that error.
- Pins, regions, hit testing and the camera continue to use the original map dimensions. An image URL change does not remount the canvas or refit it.
- Closing an unfinished opening cancels it. Closing a displayed map cancels an upgrade while retaining the current image for the existing reopen flow. Switching maps, changing room/preview/account, logout and unmount abort and release the corresponding state. Stale results cannot replace a newer selection.
- Image transfer, retries and overview-to-original fallback share the same 20-second deadline. Offscreen decoding has a separate five-second bound. An invalid or failed overview can fall back to the authorized original; 401/403/404 never trigger that fallback and clear displayed state.

## Access and caching

`GET /api/rooms/:roomId/maps/:mapId/image?size=1024` or `size=2048` uses the same current authentication, room membership, assignment, map-sharing and player-preview checks as the original image route. Unsupported or repeated size parameters are rejected; the route never accepts an arbitrary resize instruction.

Original and variant ETags are distinct. Every response, including a conditional 304, follows authorization. `private, no-cache` and `Vary: Cookie` remain in place. `X-Map-Image-Edge` tells the client the resolution actually returned. A derivative read projects only the selected overview binary from MongoDB, rather than also reading the original binary.

An old map without variants returns its original. A missing derivative asset also falls back to the original with its original ETag and actual resolution header. This permits a gradual backfill without stranding maps. No signed URL, public image, CDN service or change to revocation policy is introduced.

## Storage and existing maps

`bytes` continues to mean original-image bytes. A new optional `storageBytes` field includes the original and every stored derivative; metadata and asset records are written in the same transaction as quota reservation. Room, owner and site quotas retain their existing limits. Deletion subtracts `storageBytes`, with the legacy `bytes` fallback for old maps, and deletes the asset document containing all variants.

On the tested existing map, the 2,776,932-byte original produces 178,808- and 703,264-byte views. Total accounted storage is 3,659,004 bytes. Extra storage is real and may reduce the number of maps that fit within a room's 10 MiB quota. The upload UI now makes clear that opening views count toward image storage.

Existing images are prepared through [backfill-map-overviews.ts](../../server/scripts/backfill-map-overviews.ts). It requires an explicitly supplied `MONGO_URI` or `MONGODB_URI`; there is no implicit target database. Default/check mode performs reads and local encoding only. Scope can be restricted to one room and each invocation examines at most 1–100 candidates (default 25).

```powershell
# MONGO_URI must already be securely supplied to this process.
server/node_modules/.bin/tsx.cmd server/scripts/backfill-map-overviews.ts --check --room=ROOM_OBJECT_ID --limit=25
server/node_modules/.bin/tsx.cmd server/scripts/backfill-map-overviews.ts --apply --room=ROOM_OBJECT_ID --limit=25
```

Replace the placeholder with an actual room ID. The script logs aggregate results and sanitized failures, never credentials or image contents. Apply prepares outside the transaction, then rechecks the original and metadata inside it. It reserves only the additional bytes, leaves map counts and content revisions unchanged, and requires existing quota ledgers. Asset, map metadata and all three quota changes commit together. Concurrent attempts reserve once; retries skip completed maps. Missing assets, inconsistent accounting or exhausted quotas leave that map unchanged and produce a nonzero result. Maps without preparation continue to use their originals.

## Automated validation

Focused tests exercise early metadata/progress, image cache and preview scope, DPR/zoom/legacy selection, image deadlines/retry/fallback, response-size bounds, offscreen decode cleanup, upgrade success/failure, permission loss, rapid switches, close, logout and coordinate/camera stability. Encoder tests decode actual generated images and verify dimensions, useful byte savings and unchanged original input.

The ordinary suite completed with **916 passed and 67 existing conditional skips**. An earlier run while the build and integration startup ran concurrently timed out in the existing large Orcbrew export test; a subsequent standalone full run passed. Final full-suite/build records include the lazy encoder import, clearing an upgrade error when zoom returns to a loaded size, and the overlay feedback refinement. Backend type checking also passes.

The actual application HTTP check uses a fresh loopback-only MongoDB replica set, real authentication and routes, and the private local image copy. It covers:

- Original and both overview bytes, dimensions, Content-Length, private cache headers and distinct conditional validators.
- DM/player/stranger/unauthenticated requests, assigned-character player preview, character-restricted map sharing, DM-only denial and membership revocation, including requests carrying cached validators.
- Missing-derivative fallback and invalid/repeated size parameters.
- Read-only backfill check, idempotent/concurrent application, unchanged original hash/content revision/pins/regions, quota failure rollback and new/legacy deletion accounting.
- The actual frontend loader using these endpoints in a controlled transfer comparison.

All **68 checks** pass, including invoking the CLI's check mode and concurrent backfill attempts reserving exactly once. Its `finally` cleanup drops only the fresh isolated database and stops its own server/MongoDB processes. No production database connection or campaign write is involved.

Eight additional automated scenarios mount the actual current Vue viewer in headless desktop Edge, using intercepted scoped GETs and the private local image/overview bytes. They verify a visible metadata popup before image completion, sufficient DPR 2 initial resolution, unchanged camera/pin/region geometry and original SHA-256 across an upgrade, overview fallback, failed-upgrade retention with working retry, denied-upgrade clearing, close cancellation and logout cancellation. All pass with zero page errors and zero writes. Upgrade progress/error messages are overlaid so their appearance cannot resize the canvas. These browser checks are local, with synthetic access responses; the separate real HTTP matrix verifies authorization.

## Controlled performance check

Six alternating original-only/adaptive pairs load the same map through the actual local application routes and frontend loader. A test-only transport wrapper applies **1 MiB/s body pacing plus 100 ms**, then Sharp decodes the returned image. No browser cache shortcut is used. A fixed gate requires at least a 65% reduction in the median time to decoded initial resolution; it passes.

The original-only path takes a median **3.045 seconds** and the 1,024-pixel overview **0.311 seconds** in the final expanded run. This is roughly a 90% reduction in this controlled bandwidth-limited case. Readiness differs deliberately: full original versus sufficient fitted-view resolution for a 640 by 900 CSS-pixel viewport at DPR 1. It does not establish faster full-original readiness. The final JSON contains every observation, bytes, selected edge and metadata-ready time.

This is a Node/Sharp experiment with artificial pacing, not a browser paint, actual UI opening or hosted-network benchmark. Both cohorts run the same current prototype backend, which still contains the separately held ordinary-response change. The comparison does not measure or approve that change. Fixed pacing makes the reduced body size observable; it does not locate the cause of the production transfer variability or promise a particular public-site opening time.

## Release and rollback boundary

No deployment or production backfill was performed. A release must isolate the map-specific files from the much broader existing working tree. The earlier response candidate remains held and should not be silently included as a proven speed fix.

Before promotion, validate a review deployment with original, overview and usable-resolution timings separated; cover cold and warm requests, DPR 1/2, zoom upgrades, screen resize, missing/failed variants, auth/304/revocation and exact original bytes. Test pixels/readability at the chosen fitted resolutions and pin/region alignment automatically in the browser. Native Sharp decode and setup-level Vue tests are not substitutes for those hosted/browser gates.

Deploy the storage-accounting-aware backend before applying any production backfill. Verify quota headroom and take the normal database backup first; apply a bounded room batch and verify original hashes, variant metadata, ledgers and denied conditional requests. Legacy maps safely remain on the original if a batch cannot reserve storage.

After any derivative is persisted, a frontend-only rollback can select the original while retaining this compatible backend. **Do not roll back to the old deletion/accounting implementation while derivative-bearing maps exist**: it would subtract only the original bytes. A complete backend rollback requires a separate controlled derivative removal/accounting migration first. No quotas are raised or sharing policy relaxed to bypass a gate.

## Implementation and evidence

Core changes: `shared/room-maps.ts`, `server/models/RoomMap.ts`, `server/routes/room-maps.ts`, `server/lib/map-overviews.ts`, `server/lib/map-storage.ts`, `server/lib/map-overview-backfill.ts`, `server/scripts/backfill-map-overviews.ts`, `src/lib/map-image-resolution.ts`, `src/lib/map-loading.ts`, `src/components/maps/RoomMaps.vue`, `src/components/maps/MapCanvas.vue`, and `src/components/maps/room-maps.css`.

Five focused test files cover the encoder, resolution helper, loader and both Vue components. Ignored evidence is retained under `.local/map-overview-prototype-20261102/`: focused/full-suite reports, HTTP driver/results, controlled-performance observations, browser driver/eight-scenario results, build/server logs and explicit cleanup confirmation. A final local validation summary checks the reports and records hashes for the runtime scope. The original source copy remains in the ignored prior experiment directory, never in a public asset or committed fixture.

Final decision: **LOCAL_PASS**. `local-validation.json` verifies 916 passing tests, 41 focused passing tests (included in the ordinary count), 68 HTTP checks, eight browser scenarios, the six-pair controlled gate, a passing build and cleaned fixtures. Helper ports 4008, 27038 and 5191 are closed. Hosted performance remains **NOT_TESTED** and production remains **UNCHANGED**.

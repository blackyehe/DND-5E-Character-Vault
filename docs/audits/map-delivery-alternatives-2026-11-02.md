# Map delivery: full-quality alternatives and fresh measurements

Follow-ups: the subsequent [hosted response acceptance](map-response-acceptance-2026-11-02.md) returned HOLD. The later [expanded alternatives investigation](map-options-exploration-2026-11-02.md) compares measured overview/tiling costs, caching opportunities and private CDN designs, and supersedes the prototype order below. The original measurements remain observations, not an accepted speedup.

Sir, a 2.78 MB image does not intrinsically require eight seconds. The unchanged production image completed in under 0.6 seconds in three cache-bypassed browser reads, but later reads were much slower. The main finding is delivery variability, not an established need to reduce image quality.

## What the repeat measurements show

All eleven fresh full-body HTTP reads returned 2,776,932 bytes with the same SHA-256. No image, production code, deployment or access policy was changed between them. Browser fetches used `cache: 'reload'`; direct Node HTTP reads have no browser HTTP cache. Server/instance caches were retained, so these are uncached client transfers, not proven infrastructure cold starts.

| Cohort, in observation order | Time to headers, seconds | Body transfer, seconds | Complete read, seconds |
| --- | ---: | ---: | ---: |
| Browser pass 1, read 1 | 0.089 | 0.255 | 0.344 |
| Browser pass 1, read 2 | 0.348 | 0.204 | 0.552 |
| Browser pass 1, read 3 | 0.074 | 0.201 | 0.275 |
| Browser later pass, read 1 | 1.622 | 13.673 | 15.295 |
| Browser later pass, read 2 | 1.407 | 1.130 | 2.537 |
| Browser later pass, read 3 | 0.918 | 1.302 | 2.220 |
| Direct Node read 1 | 0.812 | 23.635 | 24.446 |
| Direct Node read 2 | 0.497 | 6.999 | 7.496 |
| Direct Node read 3 | 0.652 | 11.372 | 12.024 |
| Direct Node read 4 | 0.336 | 7.075 | 7.410 |
| Direct Node read 5 | 0.101 | 4.954 | 5.056 |

The first browser pass overlapped some direct-machine HTTP work; the later browser pass ran after that direct loop completed. Cohorts are deliberately reported separately. Different request protocols, connection routing, client location and hosted instance placement are not controlled. Large post-header gaps are visible, but no individual provider, connection, database or middleware layer is proved responsible. There is no before/after speedup measurement in this table.

The ordinary authorized conditional request returned 304 in 139 ms. Three later real UI opens decoded the full 3,072 × 4,096 map in 465, 440 and 472 ms, with browser image reuse available. Those are warm click-to-decoded observations, distinct from the forced full-body reads. The previous audit's 8.690-second sample remains valid as one observation; it was not a worst-case bound and should not be used as a prediction for every user.

## Our current path

1. Browser starts metadata and image GETs together.
2. The backend authorizes current room membership, assignments and map visibility.
3. An ETag match returns 304 after authorization; otherwise the backend fetches the image bytes from MongoDB.
4. A generic middleware intercepts responses at 2 MiB and manually streams 64 KiB writes, removing Content-Length. It handles the existing 2.78 MB map despite being intended for catalogs and backups.
5. The frontend reads the entire response with `blob()` before creating an object URL and opening the map. MDN documents that `blob()` waits for the response stream to complete: [Response.blob](https://developer.mozilla.org/en-US/docs/Web/API/Response/blob).

The server already holds the complete image before the manual streaming loop starts, and the client waits for the complete image before showing it. Streaming here does not create an incremental map display. This does not establish that streaming caused the observed long transfers: the unchanged streaming path also completed very quickly in the first browser pass.

## Alternatives used by other sites and viewers

| Alternative | Quality | Benefit for this site | Tradeoff / limit | Recommendation |
| --- | --- | --- | --- | --- |
| Ordinary bounded binary response | Exact existing bytes | Removes the generic manual-streaming path and restores Content-Length; small implementation change | Hosting-level speed gain remains unmeasured | Test first; local candidate prepared |
| Native image URL / image overlay | Full original image | Lets the browser manage the image directly and permits showing the map shell before the full image is ready | WebP is not automatically a progressively sharpening image; cancellation, authentication, retry and stale-selection behavior must remain correct | Useful second experiment, not a guaranteed transfer-speed improvement |
| Intent-based prefetch | Full original image | Downloads the map on sustained hover/focus or clear selection intent, before the final open action | Moves the wait earlier; can waste bandwidth; needs strict bounds and cancellation; does not speed a truly unanticipated first request | Optional UX improvement |
| Private object storage plus signed CDN URL | Exact original bytes | Authorize a small request, then deliver image bytes from a CDN without routing the body through Express/MongoDB | New storage/upload/delete/accounting path; signed links remain usable for their validity window unless separately revoked | Strong structural alternative if hosted delivery tails remain high |
| Private object storage behind our authorized proxy | Exact original bytes | Removes large Mongo asset reads while retaining current per-request access/revocation checks | Function still proxies the body; does not eliminate that network hop | More conservative migration than direct signed URLs |
| Deep-zoom tiles | Full detail at each zoom | Fetches only visible portions at the required resolution; scales to much larger maps | Tile generation/storage, more requests, new viewer integration and per-tile access behavior | Valuable for larger maps; disproportionate as the first fix for this single 3 MB image |
| Smaller initial image, full resolution on zoom | Full detail remains available | Reduces bytes needed for an initial overview | Initial view has fewer pixels; implementation must preserve coordinate geometry | Still valid, but the fresh results show it is not the only route |

Concrete references:

- Leaflet's official [non-geographical map tutorial](https://leafletjs.com/examples/crs-simple/) displays a Star Control II game map as one ImageOverlay with markers. A single-image game map is a normal design; tiling is not mandatory at our size. Replacing our viewer with Leaflet is not necessary just to adopt ordinary image loading.
- Vercel's [signed URL documentation](https://vercel.com/docs/vercel-blob/vercel-signed-urls) supports time-limited, path-scoped private GET URLs verified by the CDN, with GET responses served through its cache by default. This allows the unchanged image to bypass our function's response-body path after authorization.
- Vercel's [private storage documentation](https://vercel.com/docs/vercel-blob/private-storage) also describes an authenticated proxy route and storage-side CDN caching. That pattern retains an application access check on each request, but still sends image bytes through the function.
- Amazon CloudFront documents the same [private signed-content pattern](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html). A signed URL is a time-limited capability; matching our immediate sharing-revocation behavior would need an additional design, rather than assuming expiry checks reflect current room membership.
- OpenSeadragon's [Deep Zoom Image example](https://openseadragon.github.io/examples/tilesource-dzi/) demonstrates tiled high-resolution images. Its [real-world users list](https://openseadragon.github.io/examples/in-the-wild/) includes the Project Zomboid Map Project, Noita maps, museums and libraries. Its [image-pyramid example](https://openseadragon.github.io/examples/tilesource-legacy/) shows the simpler multiple-resolution alternative.
- Browser hints such as [Fetch Priority](https://web.dev/articles/fetch-priority) adjust scheduling; they do not increase available bandwidth. The current JavaScript fetch already receives normal fetch scheduling, so `fetchpriority="high"` alone is not an established fix.

## Small full-quality candidate prepared locally

`server/middleware/large-transfer.ts` now exempts only successful GET/HEAD responses for the exact map-image route when the payload is a WebP Buffer within the existing 3 MiB map limit. Ordinary Express sending supplies Content-Length. Map bytes, dimensions, source storage, image cache policy and authorization handlers are unchanged. Catalogs, backups, unrelated binaries, non-image responses and oversized bodies retain streaming.

Vercel documents a 4.5 MB buffered response limit: [Function limitations](https://vercel.com/docs/functions/limitations). The existing map cap is 3,145,728 bytes; even a 4/3 binary encoding expansion is 4,194,304 bytes. The candidate explicitly stops applying above the map cap rather than assuming every binary response fits.

An actual-app large-image check caught a routing detail in the first candidate: Express changes `req.path` inside mounted routers. The final implementation checks the original request URL, and the middleware tests now use the same mounted-router structure. The final isolated HTTP run uploaded a roughly 2.63 MB synthetic WebP, confirmed identical returned bytes and Content-Length through the actual app, then exercised authorized 304, player denial after revocation, deletion and quota restoration. All 68 checks pass and the isolated database/processes were cleaned up.

Final focused validation: 34 tests across map-loading/recovery, large responses and timing. The final ordinary suite passes 886 tests with 67 existing conditional skips, and backend type checking passes. The focused tests are included in that ordinary-suite count, not additional tests. Result files are retained below. No hosted candidate or production release was created. No measured live speed benefit is claimed for this patch.

## Recommended order

1. Compare the ordinary-response candidate with the unchanged live implementation on hosted infrastructure, using alternating full-byte reads and real click-to-decoded opens, from the user's normal connection as well as the test browser. Keep authorization/304/revocation gates. Add fixed-name map stage timings to distinguish access, asset fetch and output when needed.
2. If the tail persists, prototype direct private CDN delivery of the original image. Decide explicitly how quickly a removed player's already-issued URL must stop working. Use immutable asset paths so replacing/deleting maps and cache lifetime remain predictable.
3. Consider intent prefetch or an early map shell for responsiveness. Reserve tiled rendering or smaller overview images for demonstrated bandwidth or map-size needs.

Evidence is in `.local/map-delivery-20261102/`: hash-verified browser/direct reads, warm UI opens, focused/full test reports and actual-app HTTP/cleanup records. The existing image was never saved to a public asset or third-party service. No original map, saved character, campaign data, production configuration or deployment was modified.

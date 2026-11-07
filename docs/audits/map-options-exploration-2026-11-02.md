# Map loading alternatives: feasibility and priorities

Implementation follow-up: the selected [adaptive overview prototype](map-overview-prototype-2026-11-02.md) is now implemented and checked locally, with controlled performance observations and a production backfill/rollback runbook. No production release is implied by the feasibility results below.

Sir, the most promising **full-quality delivery change** is to serve the unchanged original from an authorized edge cache or private CDN. The strongest **measured initial-payload reduction** is an adaptive overview followed by the original when needed. They address different parts of the delay and can be combined. Neither has a demonstrated hosted opening-time gain yet.

This investigation follows the [held response experiment](map-response-acceptance-2026-11-02.md). It does not promote that candidate, resume its incomplete hosted comparison, or change production. It evaluates alternatives first, as requested.

## Evidence and boundaries

- One authorized read of the existing production image was retained only in an ignored local analysis directory. No map was uploaded, changed, or sent to another storage provider.
- Source: 3,072 by 4,096 pixels; 2,776,932 bytes; SHA-256 `db9192c42b2d1e30319d1135376982ca13e2f6ccc40c45037089093e684b42c3`.
- Offline encodes used the repository's installed Sharp. These establish actual byte/storage costs for this map, not internet latency or visual equivalence of resampled images.
- The source has image data and a 456-byte ICC profile, with no EXIF/XMP bulk to remove. The profile is not disposable padding.
- Four local full RGBA decodes took 226–233 ms. This is a local native decoder observation, not a measurement of browser decoding on the user's machine. The decoded RGBA allocation is 50,331,648 bytes (48 MiB).
- Earlier unchanged full-image downloads varied from 0.275 seconds to 24.446 seconds across distinct browser/direct-client cohorts. Large post-header waits occurred; neither MongoDB nor middleware has been established as the sole cause. See [the original measurement details](map-delivery-alternatives-2026-11-02.md).

## What is already implemented

The loader fetches details and the image concurrently, uses a browser HTTP-cache revalidation policy, and waits for the complete Blob before opening the popup. `private, no-cache` permits cached image bytes after successful revalidation; it does not disable caching. The image endpoint checks current access before returning 304. [MDN cache modes](https://developer.mozilla.org/en-US/docs/Web/API/Request/cache)

Closing and reopening through **Open large map** already retains the selected image and object URL. Clicking the same map in the list starts a new opening and discards that object URL. Consequently, a generic recommendation to “cache the map” overstates the missing work. The useful incremental opportunity is scoped reuse between list selections, with fresh access checks, rather than another unbounded cache.

Original image bytes are immutable for a map ID. Pins and regions use the original map dimensions and normalized positions. An overview can therefore use the same coordinate plane, provided its displayed extent stays at the original dimensions. A derivative must not replace the map's world dimensions or reset the camera.

## Priority assessment

| Priority | Option | What it actually improves | Access-policy fit | Evidence / remaining uncertainty |
| --- | --- | --- | --- | --- |
| First for measurable initial-load improvement | Adaptive overview, retain original | Less data and fewer decoded pixels before a useful fitted view | Existing authorization can be retained on both image variants | Measured 75–94% fewer initial bytes at the tested useful sizes; actual opening latency and readability still need a prototype |
| First for unchanged full-quality delivery | Authorized edge cache / private CDN | Removes the large image body from the current application response path; an edge hit can also avoid the Mongo asset read | Fresh authorization before every edge hit preserves next-request revocation; plain signed URLs introduce an expiry window | Strong architectural fit to observed post-header waits, but no provider or path-specific speed gain measured |
| Small companion | Early metadata shell and progress | Earlier visible response, errors and cancel control while image loads | Retain current checks and cancellation | Code establishes that the popup currently waits for the entire image; this does not make the image transfer faster |
| Next for predictable/repeat opens | Bounded intent prefetch / one-map reuse | Overlaps image work with time before a click, or avoids a repeat body read | Fresh detail authorization, strict account/room/preview scope and invalidation required | Existing HTTP caching and popup reuse reduce the incremental opportunity; no first-cold-open guarantee |
| Conditional on origin profiling | Private blob behind current proxy; slim queries; bounded server asset cache | Less work on the origin side | Can preserve current per-request authorization | Function-to-browser body delivery remains; asset cache is irrelevant to an ordinary authorized 304 |
| Defer at current limits | Deep-zoom tiles | Fetch visible resolution and regions, useful for substantially larger maps | Requires protected manifest and tile access on cache hits | Measured request/storage costs below; lossless highest-level tiles can exceed the whole original even for a partial view |
| Low priority alone | Native `<img>`; priority hints; recompression/metadata stripping | Browser-managed loading or scheduling; codec-dependent byte changes | Native URL keeps current server path, but retry/deadline behavior must be rebuilt | No removable metadata; lossless re-encoding is much larger; these do not remove the demonstrated body path |

The held ordinary-response patch is a separate low-effort candidate, not an accepted winner. Its prior local correctness results remain useful; its hosted performance gate remains HOLD.

## Adaptive overview: measured benefit and practical design

Quality-85 WebP derivatives, independently produced in two local runs with matching byte counts:

| Longest edge | Dimensions | Bytes | Reduction from original | Decoded RGBA |
| --- | --- | ---: | ---: | ---: |
| Original | 3,072 by 4,096 | 2,776,932 | — | 48 MiB |
| 768 | 576 by 768 | 101,732 | 96.3% | 1.69 MiB |
| 1,024 | 768 by 1,024 | 178,808 | 93.6% | 3 MiB |
| 1,536 | 1,152 by 1,536 | 385,674 | 86.1% | 6.75 MiB |
| 2,048 | 1,536 by 2,048 | 703,264 | 74.7% | 12 MiB |

For the existing fit calculation, a 640 by 900 CSS-pixel viewport needs about 811 pixels on the image's long edge at DPR 1, or 1,621 at DPR 2. A 1,024 or 2,048 overview respectively covers those pixel counts without enlargement. This is a sampling-size argument, not proof that recompressed text is indistinguishable. Wider/taller viewports and zoom must choose a sufficient variant or the original; never always force 1,024 pixels.

Generate bounded variants on upload or in a one-time migration, not during every opening. Keep the original bytes and hash unchanged; show a suitable overview first, then request the original when zoom/pixel demand requires it. Background upgrading after the overview is another policy, but costs the full transfer on every visit and must yield to foreground work. If the original fails, retain the overview with an explicit retry state rather than discarding a usable map.

A single 1,024 overview adds 178,808 stored bytes, or 6.4% of this original; a 2,048 overview adds 25.3%. Both add 882,072 bytes, or 31.8%. The original plus both is 3,659,004 bytes. Three such maps would exceed the existing 10 MiB room quota, although three originals fit. All derivative bytes must be included in quota reservation/deletion/reconciliation, without confusing the per-image 3 MiB cap with the aggregate room quota. Do not silently raise quotas or generate unaccounted assets.

The reduction is in the image-body term, not the whole request. For illustration only, at a fixed 1 MiB/s body rate, these byte counts imply approximately 2.65 seconds for the original, 0.17 seconds for the 1,024 overview, or 0.67 seconds for the 2,048 overview, before request, authorization and decoding costs. This is arithmetic, not a measured or promised site speed.

## CDN options: three distinct designs

### 1. Direct private signed URL

Authorize a small metadata/access request, then let the browser fetch the unchanged image from private object storage/CDN. This bypasses our large Express response and Mongo binary read. Vercel now documents path/operation-scoped signed GET URLs with CDN caching and explicit expiry. Use immutable image paths; its same-path overwrite cache propagation can take up to 60 seconds. Keep signing secrets server-side, scope URLs to GET and the exact asset, and avoid an extra control-plane token-issuance round trip per opening. [Vercel signed URLs](https://vercel.com/docs/vercel-blob/vercel-signed-urls)

An issued URL's expiry is not a lookup of current room membership. Our inference is that removing a player would not automatically invalidate that already-issued capability before expiry. A short TTL narrows the window but does not preserve current next-request revocation. Do not silently adopt that policy. Expired-link retries must obtain fresh authorization; failures must not fall back to a public URL. Also verify CORS/CORP, browser cache behavior, link/log exposure, private-store cache hits and misses, deletion behavior and storage accounting.

### 2. Edge authorization before serving cached bytes

Conceptual flow: browser requests an image through an edge handler; the handler performs a fresh, small authorization call to our application; only after success does it return the immutable cached image or read a private object store on a miss. No reusable storage capability needs to reach the browser. This retains the current per-request access decision while moving the large body off our application server path.

This is a proposed composition, not a tested integration. Cloudflare documents Workers running before cache, explicit cache lookup, and private R2 bindings with application-defined authorization. Its Cache API is local to each data center and does not provide tiered caching; a local delete is not a global purge. [Worker cache architecture](https://developers.cloudflare.com/workers/reference/how-the-cache-works/), [R2 authorization](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/)

Authorization must run before **every** cached hit and conditional 304, with failures closed and no caching of successful permission decisions. Cache only identical image bytes under a trusted immutable asset key; never cache personalized map metadata under that key. Do not rely on cache purges to revoke membership. A currently authorized user can receive already stored immutable bytes, as today; cached client bytes already downloaded cannot be recalled.

This costs an edge service, private storage, routing and credential handling, cache-miss handling and operational maintenance. Our current host-only session cookie cannot simply be assumed to arrive on a separate storage/Worker domain. A verified same-origin route or explicit secure authentication handoff is a prerequisite; otherwise this is not a drop-in solution. The fresh authorization round trip remains, so this targets the large body path rather than eliminating all latency. Keep the current image route as a controlled fallback with identical access checks.

### 3. Private blob behind the existing Express proxy

Replace Mongo binary reads with private blob reads but keep the existing authorized endpoint. Vercel documents a storage-to-function CDN cache plus the separate browser-to-function cache. This can reduce origin reads and keep current access checks, but it still proxies the body through the function. It should not be described as direct browser/CDN delivery or assumed to cure a post-header transfer stall. [Vercel private storage](https://vercel.com/docs/vercel-blob/private-storage)

All storage designs need transactional/compensating upload, reservation, deletion and orphan cleanup, plus hash-verified migration and rollback. The site has only a 100 MiB map storage budget today; adding infrastructure may cost more engineering than it saves. No new storage account, provider configuration, credential, public object or paid service was created in this investigation.

## Prefetch, reuse and loading flow

Prefetch can hide only its actual head start. A request that takes eight seconds still leaves roughly seven seconds after a click if intent gave it only one second, ignoring any connection-warming changes. Hover alone is therefore a weak answer to long unexpected opens, and touch users do not provide hover intent. Prefetch after entering the Maps section or for a deliberately selected map can offer more lead time, at a bandwidth cost.

Use at most one prepared image, bounded by the existing 3 MiB image cap and a short lifetime. Cancel pending work on selection, room, account or preview changes and when the UI leaves the relevant section. Skip speculative work for hidden/offline/save-data cases; network capability detection is advisory and not universal. Do not prefetch the whole 25-map index. Fetch the latest authorized detail before displaying cached/prepared bytes, handle denied/missing responses by clearing them, and avoid displaying a stale promise from an earlier scope. The immutable image ID makes reuse feasible, but does not authorize it.

Opening the shell after current metadata succeeds gives a visible title, progress/cancel/retry controls and useful feedback while downloading. It does not make a sharp map available sooner. Keep the image deadline, bounded retry, permission errors, stale-selection protection and cancellation from `map-loading.ts`.

Using a native `<img src>` can let the browser own loading, but our current viewer already ends in an `<img>` with a Blob URL. Changing its URL does not bypass the current image endpoint or guarantee progressive WebP rendering. Leaflet's official game-map example uses one image overlay; we do not need a viewer migration to use an ordinary image URL. [Leaflet single-image map](https://leafletjs.com/examples/crs-simple/)

## Tiling: measured feasibility

The offline experiment used 512-pixel tile cores with one-pixel overlaps and long-edge levels 512, 1,024, 2,048 and 4,096. It is a bounded custom pyramid, not a full standard DZI package. OpenSeadragon supports custom pyramid layouts and resolution selection. [Flexible pyramid example](https://openseadragon.github.io/examples/tilesource-flexible-pyramid/)

| Level | Tile count | Re-encoded quality 85 | Preserve decoded original pixels at highest level |
| --- | ---: | ---: | ---: |
| 512 | 1 | 49,300 B | 49,300 B |
| 1,024 | 4 | 182,834 B | 182,834 B |
| 2,048 | 12 | 708,284 B | 708,284 B |
| 4,096 | 48 | 2,574,034 B | 13,263,596 B |
| Total pyramid | 65 | 3,514,452 B | 14,204,014 B |

All 48 highest-level lossless tiles were decoded and compared with the corresponding original RGBA crop by SHA-256. They match. Lower levels are resampled lossy derivatives in both variants. Re-encoded highest-level quality-85 tiles are **not** pixel-identical. Lossless encoders cannot preserve the original lossy WebP bitstream when independently encoding each decoded crop; this map's resulting expansion is substantial. A full pixel-identical lossless single-image re-encode was also 13,543,972 bytes, versus the original 2,776,932 bytes. Sharp distinguishes lossless from quality/near-lossless settings. [Sharp WebP output](https://sharp.pixelplumbing.com/api-output/)

In a centered 640 by 900 CSS-pixel viewport, using the current fit inset:

- Initial DPR 1 view: four 1,024-level tiles, 182,834 bytes, slightly more than a single 178,808-byte overview.
- Initial DPR 2 view: twelve 2,048-level tiles, 708,284 bytes, slightly more than a single 703,264-byte overview.
- Four-times zoom at DPR 1: eight highest-level tiles, 2,867,284 bytes when pixel-identical—already more than the original full image.
- Twice zoom at DPR 2: 24 highest-level tiles, 7,832,192 bytes when pixel-identical.

These are payload sums for the target level only, with no prefetch ring, HTTP overhead or earlier loaded levels. Camera position changes compression/request totals; 18 viewport/DPR/zoom scenarios are retained in the report. The lossless pyramid alone exceeds our 10 MiB room quota. The lossy pyramid plus original totals 6,291,384 bytes. Tiling is still useful for much larger future maps, but is not the strongest first intervention for our current 3 MiB/4,096-pixel cap.

## Other shortcuts considered

- **Slim authorization/map projections:** maps currently load the room and full map document even when the image route only needs identity/access fields. Slim projections can reduce origin payload without weakening checks. They cannot by themselves eliminate a slow body transfer after headers. Measure authorization separately before prioritizing.
- **Bounded server binary LRU:** can avoid an asset read after fresh authorization on a repeated full-body request. Browser 304 already avoids that read. Serverless instance lifetime, memory and eviction make this a conditional optimization, not a global CDN.
- **Long browser TTL, public `immutable`, or offline service worker:** would bypass the current fresh network access check if used naively. Not an acceptable shortcut under our current sharing behavior. Immutable internal bytes can be cached behind a fresh access check instead.
- **Fetch priority, preload and preconnect:** can improve discovery/scheduling in some flows; they do not reduce bytes or repair arbitrary bandwidth stalls. Our image fetch is already started directly alongside metadata, not discovered through a deep render chain. Preconnect is relevant only if a new storage host is introduced. [Fetch Priority guidance](https://web.dev/articles/fetch-priority)
- **HTTP range requests / more parallel chunks:** the viewer needs a decoded image, not arbitrary byte ranges; reassembly still needs the full image. More requests add auth/connection overhead without evidence of a per-request bottleneck. Tiles provide meaningful spatial units if partial loading becomes necessary.
- **Codec changes:** no EXIF/XMP shortcut exists in this map. Its 456-byte ICC profile is less than 0.02% of the file. AVIF, lower WebP quality or other lossy transcodes would require compatibility, encode-cost and map-text quality evaluation; a smaller byte count alone cannot establish acceptable quality. Preserve the original as the lossless-in-behavior alternative.

## Recommended next prototypes and objective gates

1. **Adaptive overview prototype first, under the existing access policy.** It has the clearest measured reduction without a storage-provider migration. Choose by viewport/DPR; retain original world coordinates and original bytes; upgrade for zoom. An early metadata shell belongs with this flow. This changes the initial sampling, so it is not a claim that full-resolution loading is fixed.
2. **Edge-authorized original delivery as the full-quality infrastructure prototype.** Prefer a design with current authorization before cache hits. Plain signed URLs remain a simpler conditional alternative if an expiry-based revocation policy is explicitly accepted later. Do not silently trade access semantics for speed.
3. **Scoped one-map preparation/reuse as a small companion**, after measuring real intent lead times and how often existing HTTP/popup reuse already suffices. Defer tiles and server binary caching until their specific use cases appear.

For acceptance, measure **shell-ready**, **usable resolution for the current viewport**, and **full original ready** separately. A placeholder or tiny overview must not be counted as full-quality readiness. Reuse the prior alternating-cohort, uncertainty, tail, failure and cleanup principles; do not transplant its same-image full-ready speed threshold onto a different metric and call that a win.

Required automated correctness checks include byte/hash equality for the original; fresh authorization on every variant and edge hit/304; owner/player/preview/assignment/revocation matrices; scope/logout/rapid-switch/cancel races; missing/expired/failed variant fallback; pin/region coordinates and camera unchanged during upgrades; DPR/resize/zoom selection; quota reservation, upload rollback, delete cleanup and migration idempotency. Measure cold cache hits/misses and repeat opens separately. For edge delivery, verify actual routing and cookies plus provider cache-hit evidence; local simulations cannot certify them.

No manual action by the user is needed to interpret this investigation. The offline checks are conclusive about these byte counts and crop hashes. They are not acceptance of an unbuilt UI or a hosted CDN speedup. The prior response candidate remains HOLD.

## Reproduction and retained evidence

Reusable offline runner: [map-asset-options.mjs](../../scripts/benchmarks/map-asset-options.mjs). It requires an explicitly supplied private local input and output directory, uses no credentials or network, does not change application code, and writes aggregate JSON without copying source imagery into the repository.

```powershell
node scripts/benchmarks/map-asset-options.mjs --input .local/map-options-exploration-20261102/asset.webp --out .local/map-options-exploration-20261102/pyramid
```

Retained ignored evidence:

- `.local/map-options-exploration-20261102/asset-analysis.json`: source hash, WebP chunks, four decodes, overview encodes and whole-image lossless comparison.
- `.local/map-options-exploration-20261102/pyramid/report.json`: 65-tile byte totals, 48 verified highest-resolution crops, four overview sizes and 18 viewport/DPR/zoom scenarios. Experiment completed in about 13.6 seconds locally.

Validation of this change: runner syntax check, successful actual-map execution and independent report consistency checks. No production runtime file was edited in this investigation. Existing unrelated working-tree changes were retained.

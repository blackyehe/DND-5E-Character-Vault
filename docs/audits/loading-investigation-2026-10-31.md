# Compendium and Revalon map loading — 31 October 2026

The retained performance/selective-cache rollout is live as `dpl_BUZwjeATQXhJq85KKUXeGmkmvinw`, with verified public checks. Source reconciliation was pushed as commit `282199a` on `codex/verified-website-20261031`; the original dirty working checkout and unfinished Owlbear authentication remain separate. See [rollout evidence](local-only-rollout-2026-10-29.md).

## Authenticated current-library checks

The user signed in to the public website's shared browser. The checks below read their actual library and opened existing views; no source packs, characters, maps, sharing settings or pins were edited. The browser reported all 15 categories ready on device. Fourteen categories contain entries; Other reference is empty. This sampled one imported entry from each populated category, not every definition. These were current responses and may be warm; they do not reproduce or explain every historical 10–14 second cold request.

Direct full-detail requests took 303–1,195 ms in those 14 samples. Server category browsing took 342–1,304 ms. Nearly all measured full-detail duration elapsed before response headers; body transfer/reading was usually below the rounded millisecond resolution for these small entries. These observations locate the wait before rendering; they do not distinguish network latency, function cold start and individual database operations on their own.

Normal UI clicks were measured separately with a click listener, resource timings and a DOM observer:

| Entry / state | Click to details ready | Response arrival to details ready | Detail request |
| --- | ---: | ---: | --- |
| Imported spell, first UI opening | 817 ms | 2 ms | Full entry |
| Imported class, first UI opening | 584 ms | 11 ms | Full entry |
| Standard Barbarian, initial core details | 944 ms | 4 ms | Full entry |
| Imported class, cached return | 8 ms | — | None |
| Standard class, cached return | 4 ms | — | None |
| Imported class, second cached return | 8 ms | — | None |

The imported class renders 448 detail elements and about 14,000 readable characters. This is evidence against the reference display being the dominant cost for this substantial example, not a guarantee for every possible imported structure. DOM readiness is measured, not completed paint. The observer reported no long tasks during these checks; long-task coverage is browser dependent.

The standard class's levels loaded separately in 164 ms. Its 23 linked feature rules remained collapsed and made zero feature/trait requests until one was explicitly opened. Opening Rage made one 643 ms request and displayed its rules successfully. The reference code therefore does not eagerly fetch every linked feature when the class opens. A later cached class opening, after the revision-check interval, made only a detail-revision request (370 ms); it reused the full entry instead of downloading it again.

Code inspection identifies remaining cold-path exposure: authoritative revision reads, including cursor continuation for larger pack lists; source-cache lookups and current personal editions; and prepared-reader/index cache misses that can require component work or legacy source fallback. The local replay records seven database commands for a warm imported full entry, ten for a monster with enrichment consistency. These are credible targets for subsequent server traces; the current browser timings alone do not prove which caused an earlier long request. Keep authorization and edit consistency when consolidating checks. Replacing the database or broadly rewriting the reference renderer is not justified by these results.

## Revalon Kampány: Continent of Revalon

The user reported a browser failed-fetch message a few days earlier. The actual existing map currently loads successfully. Stored image metadata is 3,072 × 4,096 pixels, 2,776,932 bytes of WebP, nine locations and four regions. A direct read returned metadata in 949 ms; the image transferred in 414 ms and decoded in 180 ms. Through the normal map-list button, metadata took 735 ms and the image 753 ms, fetched concurrently. The large dialog opened with a complete image and no displayed errors. A subsequent metadata refresh took 2,489 ms but succeeded. Nothing was reuploaded or altered.

The earlier incident was **not reproduced**. Current results rule out a currently missing or undecodable image; they cannot establish whether that earlier request failed because of a network interruption, timeout, service cold start or another transient condition. Existing source uses a 15-second metadata timeout and 20-second image timeout; image transport errors can reach the user as a generic browser fetch message. Metadata and image must both succeed before the map opens.

Recommended narrow follow-up: normalize transport/timeout messages so the failed stage is clear, provide a direct Retry map action after failed opening, and permit one bounded retry for transient GET failures. Never retry a write automatically or treat 401/403/404 as a transient success. Retain cancellation when switching maps and preserve all current room/sharing checks. If the failure recurs, capture the failed URL category, status or abort reason and duration immediately; do not log cookies, map bytes or campaign content. No speculative map fix was published from this investigation.

Ignored evidence: `.local/loading-investigation-20261031/results.json` and `measurements.html`. Full source text and image bytes are not copied into the report. The signed-in browser is left available for the user; temporary timing observers are removed by reloading its Compendium page after measurement.

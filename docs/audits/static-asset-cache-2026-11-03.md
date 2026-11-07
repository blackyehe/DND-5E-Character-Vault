# Static asset caching — 3 November 2026

The public site now uses deployment `dpl_G4VcVwyRjnkwauifkNHbhxzVX1ir`, promoted at 2026-11-03T22:49:40.925Z. The exact preceding complete-backup release, `dpl_9E2f9tBXXfZVGbiWPediwLufEpnt`, is the rollback target. Only `vercel.json` differs among the 482 frozen source/test inputs; unrelated local changes are excluded.

## Finding and change

Vite's generated, content-hashed JavaScript, CSS and fonts were delivered with `public, max-age=0, must-revalidate`. Browsers retained their contents but still contacted the server to validate each file when reloading the Compendium. The frontend `/assets/(.*)` rule now sends `public, max-age=31536000, immutable`. Changing an asset changes its generated URL. This follows [Vercel's guidance for hashed assets](https://vercel.com/docs/caching/cache-control-headers) and its [asset-header configuration example](https://vercel.com/docs/project-configuration/vercel-json).

The frontend SPA fallback excludes `/assets/`: missing script URLs now return 404 rather than application HTML. The top-level service router and API routing are unchanged. HTML and the public favicon retain their existing revalidation policy. Authenticated APIs remain private/no-store; anonymous protected reads still return 401. This policy does not cache character, Notebook or map API data publicly.

## Acceptance evidence

Four alternating control/candidate pairs each used an isolated Edge profile, a priming Compendium visit and a subsequent reload. Both versions have identical generated asset paths and bytes. CDP's `requestServedFromCache` event, wire-status metadata and Resource Timing distinguish cache reuse from network validation.

Every control reload made 22 asset validation requests and received 22 status-304 responses. Every candidate reload reused all 22 assets from browser cache with zero asset validation requests. The same structural result passed against the hosted candidate and the promoted public alias. This is the clear positive indicator; it requires no user inspection. It applies while those assets remain in browser cache and does not accelerate an empty-cache first visit.

Observed public reload readiness ranged from 202–221 ms for the control and 137–196 ms for the candidate. Hosted timings were noisier and included slower candidate observations. These are finite samples, not a causal speed guarantee, p95 estimate or worst-case bound. The release claim is eliminated validation requests, not elimination of the earlier intermittent multi-second cold/full-navigation delivery delays. Those delays remain unresolved.

Eight owner API response groups matched the previous deployment, including characters, room, Creator selections, Notebook, Workshop and Maps. Hosted and public browser checks passed at desktop/mobile widths, including Compendium list/detail, route recovery, login labels and anonymous protected redirects. These checks made no application mutation requests and observed no uncaught browser errors. Region, environment-variable names, Notebook feature overrides and published application code are unchanged. Existing passing application tests/build/types were retained because the only release change is hosting configuration.

## Reproduction and records

Ignored helpers/evidence are under `.local/delivery-followup-20261103/`: `baseline.mjs`, `cache-acceptance.mjs`, `cache-acceptance.json`, `public-cache.json`, source/scope manifests, hosted/public read/browser results, `promotion.json` and `final-gates.json`. Run `node .local/delivery-followup-20261103/final-gates.mjs` to recheck the live alias, source scope and acceptance records. Run the cache acceptance helper only when a fresh measurement is needed; a new run is a new sample.

The immediate rollback command is `node .local/delivery-followup-20261103/release.mjs rollback`. It verifies the live alias before promoting the preceding compatible backup release. No rollback was needed.

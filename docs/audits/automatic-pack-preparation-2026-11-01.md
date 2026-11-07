# Automatic preparation of changed imported packs - 1 November 2026

## Result and release status

Published and publicly verified at `https://dndoldal.vercel.app`. Live deployment: `dpl_5aAwkFLg8Wv3juLoP1eH9FQ2AZPb`; immutable review: `https://dndoldal-betw2l331-dndenjoyerstudio.vercel.app`. Rollback: `dpl_61xCxd5qpVG7HAEtLq8UDzgwspTw`. The production project flag is persisted as `COMPENDIUM_PACK_PREPARATION=on` for future deployments, with the existing prepared-reader scope unchanged. The frozen runtime source intentionally retains the prior deployed README; the Git branch has a previously documented README-only difference.

The website can prepare an exact current imported pack after a successful import, replacement, settings change, Workshop/library mutation, or an explicitly marked idle Compendium revision check. Unchanged valid prepared packs are reused. Existing catalogue-only preparation is not automatically expanded across the whole library. Canonical imported source, character inventory copies, room assignments and permissions remain authoritative.

## Measurements before release

Integrity-verified private 126-pack snapshot; all 15 complete category indexes (15,017 records including standard content) retain their baseline hashes. In a fresh-process test with two changed large packs and 150 ms injected per complete database reply:

| Same source revision and complete response | Before automatic preparation | After preparation |
| --- | ---: | ---: |
| Cold category response | 27,928.68 ms | 4,285.38 ms |
| Database commands | 358 | 27 |

Saving: 23,643.29 ms, or 84.66%. The complete response hash is identical. This deliberately exercises a slow rebuild; it is not a prediction for every live entry opening. Existing browser/local caches can already avoid many of these reads.

Preparing the two 3.7/14.9 MiB packs took 3,078 ms on local MongoDB without injected delay and added 4,482 objects / 9,147,078 BSON bytes (8.72 MiB). This moves computation and writes earlier; it does not eliminate them. Indexes, job/lease/ledger metadata, and pre-existing untracked derived generations are additional storage. A cold-parser worker reduced observed maximum HTTP event-loop delay from roughly 693 ms to 108 ms in this fixture; remaining projection and serialization still have a cost.

## Safety and lifecycle

- Default feature flag is off. Enabling it also requires the existing prepared-reader owner scope; that scope is not widened.
- Durable job per pack; repeated changes coalesce to the current source. Exact owner, source hash, timestamp and settings are checked before publication. Interrupted work resumes on a later eligible request/idle wake. No always-running service or cron was added.
- Official Vercel `waitUntil` is registered during the request and starts work after a successful response. The worker reserves ten seconds before the invocation deadline and has a 90-second soft limit. It does not extend Vercel's maximum invocation duration. Closed, failed and unauthenticated requests cannot start preparation. Normal foreground/room GETs do not wake it.
- One global worker lease. Limits: 16 MiB decoded / 32 MiB stored source, 12 MiB BSON per generation, 32 MiB owner / 64 MiB global tracked automatic generations, 10,000 objects per generation, 512 packs per owner, 4,096 jobs. These bound automatic derived BSON, not total database storage. Storage pressure defers work; oversized work remains on the existing read fallback.
- Immutable chunks are verified before current-manifest publication. A source update/deletion or lost lease prevents stale publication. Partial failed generations are removed; crash leftovers are collected later.
- Retired automatic generations have a ten-minute grace measured from observed retirement, not initial creation. Current generations are retained. Cleanup rotates bounded batches and only removes tracked automatic derived data. Cleanup needs a later eligible wake; it is not a wall-clock deletion guarantee.
- Cold large EDN parsing runs in a 256 MiB-limited worker. The generated worker is tested against the canonical parser and checked for freshness. Async compression avoids synchronous gzip on this path. Hosted cold-worker execution is a required release gate.
- Owner-only preparation status reports readiness/fixed reasons without exposing source, lease tokens or another owner's data. Existing reads remain available if background work or the SDK is unavailable.

## Local validation

- 728 standard tests pass; 60 skips include 48 existing and 12 opt-in database tests.
- All 12 opt-in tests pass against unique loopback MongoDB databases, including duplicate/concurrent wakes, lease recovery, source replacement/deletion races, quotas and retry, size guards, reader grace and cleanup rotation. Fixture databases removed.
- Backend/frontend types pass; frontend production build passes.
- Actual Express import of exactly 16 MiB forces the cold-parser path (source plus parsed output exceeds the existing 32 MiB parser cache). Import returns in 391 ms locally; queue work starts after response completion. Preparation reaches full-detail ready; original export hash and source metadata are unchanged; complete long rules retained; unauthenticated/foreign status and detail requests rejected. Fixture database removed.
- Exact candidate runtime source manifest: 420 files, 16 changed/added compared with the frozen production baseline. Public `.env.example` is included; no private environment files are included. Unfinished Owlbear remembered-login changes remain excluded.

Ignored evidence: `.local/automatic-pack-preparation-20261101/`, including `comparison.json`, `indexes-*.json`, `automatic-costs.json`, `local-validation.json`, `queue-integration*.json`, `http-check.json`, `expected.json`, and `scope.json`. Private snapshot sources and credentials must never be committed.

## Hosted and production gates

All gates pass: exact 420-file deployed input-source audit; seven hosted preparation scenarios; 11 character/editor/player scenarios; seven map scenarios; ten rule/API/desktop checks; protected endpoints, security headers and Owlbear origin/auth boundaries. Synthetic fixtures ran sequentially and active content was removed after each run. Original real campaign content was untouched.

After promotion, the public website passed the same seven preparation scenarios, seven map checks, ten rule checks and HTTP/security gates. The public 16 MiB import returned in 1,261 ms. No requests were made for twelve seconds after import, then the first status read confirmed full-detail readiness, proving that the continuation and packaged cold worker execute on Vercel. This bounds observed readiness; it is not an exact twelve-second preparation duration. Settings preparation was observed within 2,426 ms and replacement readiness within 629 ms of their polling checks. Original source export remained exact, complete rules were retained, replacement rules were current, and foreign access remained denied.

Release records: `staged.json`, `deployed-audit.json`, `hosted-*.json`, `promotion.json`, `public-*.json`, `live.json`, and `feature-persisted.json` in the ignored evidence directory. Rollback was not required. Local snapshot, queue and HTTP fixture databases were removed; retired hosted derived generations retain the documented grace and later-wake cleanup policy.

The separate paused-check status/resume UI follow-up is not changed by this batch. The worker uses existing permitted idle checks; it does not change browser scheduling or claim uninterrupted background activity.

References: [Vercel function helpers](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package), [invocation duration](https://vercel.com/docs/functions/configuring-functions/duration), [environment variables](https://vercel.com/docs/environment-variables).

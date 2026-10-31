# Rules queue release — 31 October 2026

Published `dpl_E3e6XryBe1d8MsqtMMQ5BcmYLyGX` at https://dndoldal.vercel.app. Exact reviewed source: https://dndoldal-ew9743jpb-dndenjoyerstudio.vercel.app. Rollback: `dpl_BUZwjeATQXhJq85KKUXeGmkmvinw`.

The 412-file package changes only `server/lib/srd-client.ts` and adds `server/lib/srd-request-queue.ts`. Interactive rules lookups take priority over queued background lookups, keep the existing shared cadence and background retry behavior, and include queue/body time in their lookup deadline. Background work retains fair access. Frontend and authentication code match the previous verified release exactly; unfinished remembered authentication remains separate.

Local validation: 662 tests, 48 existing skips, backend type checking and seven dedicated queue/deadline/pacing tests. The controlled long-queue response hash and total request count match; background batch completion remains about ten seconds. Measurements and their limits are in [the investigation](compendium-tail-latency-2026-10-31.md).

Hosted checks pass: exact source audit, eleven owner/player workflows with cleanup, eight protected API boundaries, security headers, extension 403/401 boundaries, and ten rules/API/browser checks. Public verification repeats the HTTP and rules/browser checks, confirms the promoted alias and reviewed frontend bundle, and creates no saved content. The rules checks include repeated-response equality, a missing rule returning 404, authenticated Compendium class details, levels and expanded Rage rules.

This release does not implement the larger changed-pack rebuild remedy. That work continues in an isolated local prototype. No historical user stall is attributed conclusively to this queue condition. Ignored evidence: `.local/srd-queue-release-20261031/`.

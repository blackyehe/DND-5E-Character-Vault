# Bounded changed-pack fallback — 31 October 2026

The user authorized publishing the Compendium loading improvements and continuing the plan. The preceding [interactive rules queue fix](srd-queue-release-2026-10-31.md) is live. This follow-up avoids rebuilding an entire imported library when exactly one eligible large pack lacks current prepared components. It is now published and immediately publicly verified.

## Behavior and limits

The existing prepared reader and its small inline repair budget remain the first path. Previously, a large invalid pack could make that reader fall back to reading and parsing all packs. The new alternative validates and reuses unchanged prepared catalogues, then reads only the one changed source and projects the requested category. Full entry resolution may reuse the same exact parsed source after a current owned-pack metadata lookup.

This alternative is read-only with respect to authoritative sources and stored component generations. It requires one requested category and exactly one invalid component, capped at 16 MiB decoded and 32 MiB stored source. Current owner, revision, fingerprint, chunk integrity and existing result-size limits remain checked. Multiple invalid packs, excessive sizes, invalid chunks or other unclassified failures retain the existing availability fallback. The normal 15-second prepared probe budget is unchanged. Like the original legacy fallback, this bounded-source alternative has no overall elapsed deadline; it does not promise every entry opens within a fixed duration.

There is no new automatic preparation job, source migration or cache retention budget. Stored preparation after every import remains a possible later improvement requiring job lifecycle and superseded-generation cleanup controls. This release changes seven server library files; it changes no frontend, route, authentication or model definitions. Unfinished Owlbear authentication stays separate.

## Controlled comparison

The verified 126-pack snapshot was replayed in a uniquely named loopback-only database. One 3.7 MiB pack's revision timestamp changed while its source bytes stayed unchanged. Each comparison used a fresh Node process and no current category index. A local wire relay injected 150 ms per complete database reply, retaining concurrency. This deliberately delayed scenario reproduces the costly fallback; it is not a production cluster measurement or proof of the user's historical incident.

| Exact complete-response comparison | Baseline | Candidate |
| --- | ---: | ---: |
| Cold entry read | 27.896 s | 7.436 s |
| Database commands | 358 | 57 |

The measured reduction is 20.46 seconds, or 73.35%, in this scenario. Complete response hashes match. A later persistent source-cache hit remains about 1.1 seconds under the same injected delay. Ordinary warm entry opens should not be assigned this 20-second saving.

All 15 complete category indexes match the baseline canonical hashes across 15,017 snapshot entries. An authenticated local HTTP replay returns 401 without authentication, 404 for a foreign owner and 200 for the owner; repeated full responses match. Source batches contain one pack, and source metadata and stored component manifests/object counts remain unchanged. The isolated database was dropped after host/database assertions. The real library and its caches were not cleared.

## Validation

- 681 tests pass, with 48 existing skips. Backend type checking and the production frontend build pass.
- Focused coverage includes size limits before decompression, UTF-8 byte limits, corrupt/missing unchanged chunks, multiple invalid packs, revision/hash mismatches, current ownership, parsed-source reuse and failure-tier separation.
- The staged deployment's 412 runtime files match the frozen package. Only the seven allowed server files differ from the live queue baseline.
- Eleven hosted owner/player workflow checks pass, including imported item delivery and retry deduplication, full saved rules, editor save, player references with an empty personal library, stale-write rejection, room sections and unassignment. Fixtures are cleaned.
- Six additional hosted large-pack checks pass with a synthetic 3,879,995-byte source: import/source retention, full entry equivalence, character/editor class identity, selected player references without unrelated definitions, actual desktop reader display and access revocation. Fixtures are cleaned.
- Hosted standard-rule/API checks and desktop class/level/linked-rule expansion pass. Public/security and Owlbear origin/session boundary checks pass on the reviewed candidate.

The hosted synthetic accounts validate compatibility and access boundaries. The deployment's prepared-reader feature scope is unchanged; the deliberately invalid-component branch is established by the isolated prepared-reader replay, not claimed as forced hosted coverage. Browser presentation measurements from the earlier [loading investigation](loading-investigation-2026-10-31.md) were quick, but do not establish a universal one-second conversion limit for all entries.

## Release evidence

Candidate: `dpl_FzBdyV5yuKkPYKwyXRJyxAyQ7s59`, immutable `https://dndoldal-itpupb2bj-dndenjoyerstudio.vercel.app`.

Baseline and rollback: `dpl_E3e6XryBe1d8MsqtMMQ5BcmYLyGX`, immutable `https://dndoldal-ew9743jpb-dndenjoyerstudio.vercel.app`.

Ignored evidence: `.local/compendium-mixed-fallback-20261031/`, including the exact source/control, scope and hashes, local validation, response/index equivalence, authenticated HTTP replay, delayed comparisons, hosted checks and cleanup. Promotion verifies all local and hosted gates, confirms the baseline alias, then runs immediate public HTTP and desktop rules checks with automatic guarded rollback on failure. The resulting `live.json` is the authoritative release record.

Published at 2026-10-31 22:27 UTC (23:27 Europe/Budapest). The public alias points to the candidate above. Immediate public HTTP/security checks, protected API and Owlbear origin/session boundaries, standard rule response equivalence and actual desktop class/level/linked-rule interaction pass. No rollback was needed. The preceding queue release remains the rollback target.

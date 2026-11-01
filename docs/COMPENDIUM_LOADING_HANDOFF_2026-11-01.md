# Compendium loading: bounded next-session handoff

Published update: [the normal foreground cache lookup now avoids one database read when the legacy cache misses](audits/foreground-cache-lookup-2026-11-01.md) without fetching both payloads. Eight isolated database scenarios and 43 focused tests pass, along with hosted/public read-only checks. Live latency savings have not been measured. Production deployment: `dpl_922Tuz5hpV7iS3Tuv45pju2hNDVe`.

Update: the larger visible-page detail preloader is now published and publicly verified. See [behavior, measured incremental benefit, traffic costs and release work](audits/visible-compendium-details-2026-11-01.md). It reuses the existing cache, warms only up to 25 default visible versions in bounded batches, and preserves normal click fallbacks. Per-entry freshness tracking remains separate.

Update: metadata batching is now published with the visible-page preloader. The actual application query passes the isolated comparison and 30 focused tests; backend types pass. See [incremental results and remaining release step](audits/compendium-metadata-batching-2026-11-01.md). The earlier groundwork descriptions below are historical; do not repeat the implementation or the large benchmarks.

Prepared on 1 November 2026. Groundwork only: no application, dependency, database, or deployment changes in this batch.

## Starting point

- Last verified public deployment: `dpl_6fm5k6C6Ad6ArkMw77cp73Bt1ijA`, `https://dndoldal.vercel.app`.
- Website code checkpoint before this documentation/helper batch: `3ede6b4`, branch `codex/verified-website-20261031`.
- Isolated verified checkout: `.local/verified-website-20261031/`. Use this for implementation and releases. The original checkout contains unrelated dirty changes, including unfinished Owlbear remembered login; preserve them.
- Frozen live source and release evidence: `.local/pause-feedback-release-20261101/`. Its manifest has 420 files and three frontend runtime changes relative to the automatic-preparation release. Check for a newer baseline before making another change.
- Public pause-feedback checks pass. A permanent paused-state defect has not been reproduced. New messages distinguish room, offline, hidden-tab and foreground pauses.

Already implemented: automatic device search-index preparation, bounded persistent opened-entry cache, current owner/revision validation, and durable server preparation for changed packs. Do not implement or advertise these again. The previous large timing improvement concerns a controlled rebuilding case, not ordinary current entry clicks.

## First: one focused current measurement

Use the same account, category and representative imported entry for a first UI opening and a reopening. Record detail/revision endpoint durations, response wait versus body transfer, click-to-ready time, and whether the response came from device/memory/server. A new page/session does not necessarily mean a cold server or empty persistent cache; label the observed state honestly. Do not clear the real user's caches or modify their library to force a miss.

Prefer an existing authorized website session. If unavailable, state that the real library was not measured; a tiny synthetic account cannot stand in for the user's 126-pack library. Do not export production secrets. Existing snapshot evidence can guide the next step without reimporting or rebuilding everything.

## Small implementation candidates, in order

1. **Metadata batch size.** `server/lib/compendium-browse.ts`, `browseRevision` (currently around line 31): small projected metadata is loaded with no explicit cursor batch size. Existing traces contain cursor continuations; they are a hypothesis, not a measured current saving. A bounded larger batch, such as 512, is a candidate. Preserve the owner/type filter, projection, sort, complete result and both consistency checks.
   - Narrow experiment: uniquely named loopback-only MongoDB fixture with 126 small synthetic metadata documents, no original pack sources. Compare the current query against the same query with the candidate batch size. Assert identical complete documents/revision hash and count `find`/`getMore` using driver command monitoring. Include a fixture larger than the chosen batch to prove results are not truncated. Drop only the guarded fixture database.
   - Keep only if it removes an actual exchange without changing results. Run relevant browse/detail tests, not the whole historical release matrix. A mocked query chain alone does not prove cursor savings.
2. **Combine source-cache compatibility lookups.** `server/lib/compendium-entry-source.ts`, `importedCompendiumSource` (around line 63). It awaits the older cache namespace, then the current namespace. Consider one query for the two exact revisions, using the existing unique owner/revision/kind/index index (`server/models/CompendiumEntryCache.ts`). Preserve legacy preference, digest/size/expiry validation, owner isolation and prepared-source fallback. Cover legacy hit, current hit, corrupt legacy with valid current, both absent, expired and foreign entries. Do not remove compatibility blindly.
3. **Visible-page preloading, later.** The user proposed fetching full values only for the visible page. This needs bounded request/data sizes, limited concurrency, cancellation after filter/page/account changes, room/foreground pause, and click/prefetch request sharing. A page represents families and can contain more than 25 versions; initially fetch only each displayed/default version. The existing detail loader marks work as foreground, so calling it directly on hover is not a safe background implementation. Inspect `src/views/CompendiumView.vue`, `src/lib/compendium-detail-cache.ts`, and `src/lib/foreground-work.ts` before designing it. Per-entry freshness is a separate larger change: current detail validation uses a broader library revision.

The first two candidates target database waits; preloading targets perceived first-opening delay and can create unused reads. No additional saving is established yet. Do not promise another multi-second gain or use the pre-optimization full-library rebuild as the comparison baseline.

## Reuse existing evidence cheaply

From the verified checkout, or using its absolute script path:

```powershell
node scripts/summarize-compendium-trace.mjs <absolute-path-to-trace.json>
```

Known compatible historical trace: `.local/automatic-pack-preparation-20261101/cold-stale-final-after-delayed.json` relative to the original workspace root. It includes deliberately injected database delay; the helper reports this explicitly. It reads files only, summarizes request counts/durations, and omits source payloads and private identifiers. It does not contact a server or perform a benchmark.

Useful existing references: [ranked options](audits/compendium-next-small-options-2026-11-01.md), [real-browser observations](audits/loading-investigation-2026-10-31.md), [automatic preparation](audits/automatic-pack-preparation-2026-11-01.md). The runtime detail path is `server/lib/compendium-details.ts`; the browser cache is `src/lib/compendium-detail-cache.ts`. Preserve the before/after revision checks: removing them can serve mixed or stale rules during an import/edit.

Budget rule for the next session: implement one candidate, make one controlled comparison against the current baseline, stop and report its incremental result. Reuse passing evidence for unchanged systems. No full 126-pack replay, new cache architecture, broad cleanup or database replacement unless a specific finding requires it.

## Ready-to-run isolated metadata probe

A small harness is now available; it invokes the actual current `browseRevision` function and compares its revision with the same projected query using a batch size of 512:

```powershell
node --import ./server/node_modules/tsx/dist/loader.mjs scripts/probe-compendium-metadata-batch.mjs --run
```

Run from the verified checkout. Help/default invocation performs no database work. `--run` always creates its own randomly named `metadata_batch_probe_<hex>` database on loopback port 27017; it accepts no external database URI and never uses the configured application database. It inserts only synthetic metadata, checks 0, 126 and 600 matching documents plus excluded owner/type records, monitors database command counts, verifies identical full revision hashes, and removes its fixture database. It loads no pack sources or browser sessions.

The harness was exercised successfully: all revisions matched, the 126-document case avoided its cursor continuation with the candidate batch, and the 600-document case retained every result across multiple batches. Fixture cleanup passed. This establishes a narrow local command-count opportunity, not a live latency saving. Application code remains unchanged; implementation, focused browse tests and one current-baseline measurement remain for next session.

# Selective Compendium synchronization and opened-entry persistence

Implemented and verified locally on 2026-10-29. Not committed, pushed or deployed. No production content or database schema was changed. The user selected saving full details when opened, rather than preloading unopened entries.

## Behaviour

After the library revision changes, background preparation compares the exact SHA-256 fingerprint of each category's current browsing index with the verified disk copy. An identical category retains its payload and receives the newly authorized library revision. A changed category still downloads its complete index. Expired, malformed or differently owned copies cannot be relabelled. Revalidation rechecks actual stored bytes, preserves the original seven-day age, and rejects concurrent library mutations. Existing server index readers and dependency handling remain intact.

Full entry values opened in the Compendium or imported-item picker are stored separately in IndexedDB. They survive page reloads and same-account reauthentication. Before disk reuse, the client validates an authenticated detail revision; recent successful validation is reused for up to 30 seconds. Local content mutations invalidate recent validation immediately. Detail revision identity also includes saved monster enrichment changes, which do not necessarily affect compact browsing rows.

The detail cache is limited to 16 MiB and 200 entries, with a 1 MiB per-entry cap and seven-day age. Oversized entries still load from the server but are not persisted. Checksums, shape, account, category, entry ID, format and age are checked before reuse. Explicit logout clears the detail store, scope changes cancel pending writes, and late responses/checksums cannot be adopted after account changes. Room/player/character response endpoints are not admitted to this cache. Images and separate class-level/feature endpoints are outside this change.

## Calculations

The earlier captured 126-pack library required 1,623,942 compressed response-body bytes to export all browsing indexes. Its spell index payload compresses to 36,090 bytes; its magic-item index payload to 471,674 bytes. A representative fingerprint-validation JSON body is 242 bytes, so fourteen unchanged-category replies total about 3,388 bytes.

| Changed category | Approximate replacement payload plus unchanged-category fingerprint replies | Reduction against previous all-category export bodies |
| --- | ---: | ---: |
| Spells only | 40 KB | 97% |
| Magic items only | 475 KB | 71% |

These are transfer estimates, not hosted response-time measurements. They exclude HTTP headers, the replacement export envelope and ordinary revision-check replies. At 3 Mbps, transferring 1.624 MB takes about 4.33 seconds, while 40 KB takes about 0.11 seconds; database work, latency and deliberate preparation gaps are additional and may dominate.

Bundled SRD full-detail examples have median sizes of 1,416 bytes for spells, 804 for magic items and 830 for equipment. Their 95th-percentile sizes are 2,939 / 2,212 / 1,301 bytes respectively. Private imported entries may be much larger, so these are examples rather than an imported-library capacity claim.

## Verification

- Full suite: 610 passed, 55 skipped, no failures. Final subsequent byte-accounting hardening also passes all 11 engine tests.
- Workspace frontend build and server type check pass. The isolated release candidate's production build and server type check also pass.
- The isolated candidate starts from the exact current live package, `dpl_2ikH6NWEv5xR72kvArSMb3CMHw8z`: 389 baseline files verified, 14 runtime files allowlisted, 393 candidate files. Unrelated dirty extension/editor changes were excluded.
- Real browser / worker / IndexedDB fixture: initial background preparation exported each of 15 categories exactly once. Adding a spell changed the authoritative revision; only spells exported a second time. All fourteen other export counts stayed at one, with fifteen content-fingerprint comparisons and eventual 15/15 ready status.
- Two entries were opened initially. Reopening a saved spell after reload added one revision check and no full-detail response. Changing the library caused its updated full values to be fetched once. A subsequent reload reused those updated values without another full-detail response.
- Tests cover category changes, invalid owners/kinds/versions, concurrent edits, corrupt/expired disk copies, authenticated endpoint boundaries, deleted entries, monster enrichment, late logout/account-switch results, checksum races, optional storage/hash failures, byte/count eviction and logout-clear races.

Evidence is ignored local material under `.local/selective-compendium-20261029/`: `source-audit.json`, `measurements.json`, `final-tests.json`, `after-reload.json`, `after-selective-update.json`, `fixture-evidence.json` and `browser-reviewed.png`. Browser authentication and mutations were fictional and local.

## Remaining costs and release gate

1. This avoids unnecessary browser downloads. The server may still rebuild/check category indexes after a library mutation; it is not a replacement for category-scoped database dependency revisions.
2. Changed categories still use whole-category replacement, not per-entry deltas.
3. Detail validation is currently library scoped within its category namespace. A library change can invalidate previously opened detail copies even when those particular entries did not change; only subsequently opened entries are fetched again.
4. Fresh full-detail responses compare revisions before and after assembly to prevent stale values being stamped with a newer revision. This adds metadata queries on a first or invalidated open. Hosted first-open latency must be measured before recommending live publication. No new hosted seconds-saved claim is made here.
5. The existing Git/live baseline discrepancy remains unresolved. Any release must continue using an exact audited source package or first reconcile that baseline; the release guard must not be weakened.

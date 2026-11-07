# Creator option release — 29 October 2026

Published at https://dndoldal.vercel.app as **`dpl_2RYNZuT8g8d4UvY7At6cWvwzcCDB`**. Reviewed deployment: https://dndoldal-q6fzej78d-dndenjoyerstudio.vercel.app. The public alias and public bundle were verified after promotion. Rollback target: `dpl_2ikH6NWEv5xR72kvArSMb3CMHw8z`.

## Released scope

The [completed creator authoring scope](creator-option-completion-2026-10-29.md) is live: feats/backgrounds, invocations/boons, durable nested choice groups, languages/reference entries and parent-aware subraces, with their draft, pack, recovery, character and selected-only room paths. The reproduced late-name creator failure and biography/notes save omission are corrected. Manual prerequisite/class allowance review and manual permanent-stat review when changing an existing character's ancestry remain explicit limits.

Automatic Compendium preparation is preserved. The retained selective synchronization/full-detail persistence changes are excluded, as are unrelated extension/editor/polling changes. No account migration, database replacement or billing change was made.

## Isolation and compatibility

All 389 files of the preceding live source were checked against the deployed source manifest. The new package contains 404 runtime files and an explicit 49-file change allowlist. Three-way merging preserves live changes absent from Git. The calculation implementation stays in the existing live module; two new imports were adapted to that module rather than publishing the unrelated module relocation. Only the blocked-review UI additions were carried into the previously dirty Compendium editor. Every deployed source file matches the audited package.

The existing Git/live discrepancy remains unresolved. No Git commit/push was made and no release guard was weakened. This was publication of a separately validated source package, not the dirty checkout.

## Additional loading safeguard

The initially implemented twelve-category rule catalog added 784,325 serialized bytes on the saved 126-pack snapshot. Before publication, the prepared reader was changed to start with the six existing categories and request additional kinds only for actual selected features, ancestry, learned languages or the active picker. A current owner cache can grow to a needed superset; narrower requests reuse it. A library revision change discards unnecessary previous scope. Concurrent broader requests cannot adopt an incomplete pending result. The existing full-reader fallback remains available.

An isolated MongoDB replay prepared all 126 packs, then verified real component reads with zero raw-pack reads. The ordinary six-category catalog was 4,318,814 serialized bytes. Adding selections produced 4,638,854 bytes; languages, subraces and other manual kinds were added only when requested. Creating a new native group after a mutation returned to the requested seven categories and preserved its selected child grant. Observed loopback composition times were 101–136 ms; these are **not hosted/private-library latency measurements**.

The compact four-category manual picker response remains 84,145 bytes / 13,837 gzip bytes on that snapshot. No hosted seconds-saved claim is made.

## Verification

- The exact deployment-only source builds and passes server type checking. The workspace suite passes **650 tests, 55 skipped**. The isolated creator/scope suite passes **62 tests**.
- Broader Git tests were run against both the untouched live source and candidate: 529 versus 569 passing assertions, with the same 14 failures and the same unavailable-module suites on both. These are recorded Git/live test mismatches, not an all-green candidate suite. No additional failure was introduced. The differing extension, polling and cache implementations were preserved from live rather than copied from Git to satisfy mismatched tests.
- The exact candidate passes **23 local API** and **14 desktop** scenarios, plus all 15 cached Compendium categories and explicit logout clearing. The six prepared-reader replay checks include new native content after mutation. Local fixture databases report cleanup.
- **Nine hosted scenarios pass** using isolated reusable accounts: author/reopen every new kind; owner boundaries; nested/future grants; same-name isolation through both room reference endpoints; saved Workshop reopening; complete creation with real hosted Human/Fighter rules; editor choice changes and notes/biography; player selected-child text; HP/stale-write handling; and revocation of an already-open player sheet. Scenarios contain multiple assertions. Hosted test characters, pack, assignment and added membership were removed; both accounts' active imported libraries and the owner's active characters were confirmed empty. No real library or character was edited.
- Staged/public security headers, six unauthenticated 401 boundaries and frontend delivery pass. After alias confirmation, the public main script matches the reviewed deployment. An authenticated public check confirms the empty test library and all eight authoring controls, with no JavaScript exceptions.

Ignored evidence: `.local/creator-release-20261029/`, including exact source/manifest, baseline comparison, local/prepared/cache results, hosted cleanup/results, deployed source audit, promotion/alias receipts and public checks. Earlier fixture/alias-propagation diagnostics are preserved separately from final receipts.

## Next work

The separate special imported-item validation finding remains open at release time. Work continues locally on fixed damage, missing standard damage rules and oversized descriptions; those subsequent changes are not part of this deployment.

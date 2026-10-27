# Imported character choices and Compendium recovery

Released to https://dndoldal.vercel.app on 2026-10-27.

- Repair commit: `894da8c`.
- Released deployment: `dpl_7FB8zBXowAKfqZt8izXd8SVFTY53` (`dndoldal-j0tzgk50t-dndenjoyerstudio.vercel.app`).
- Prior deployment / rollback target: `dpl_9aiXB7rcj34Mi9bp277AJa1KhZ9M` (`dndoldal-pi1c0ax9s-dndenjoyerstudio.vercel.app`).
- Stable staging address: https://dndoldal-library-repair.vercel.app.
- Pre-repair backup tag: `backup/library-loading-2026-10-27` at `7815a63`.

## Cause and repair

The account's 126 Orcbrew packs triggered repeated full-library rebuilds across server instances. Production logs showed connection-pool exhaustion and 300-second function timeouts. Character creation made eight separate imported-category requests with 15-second client limits, then silently substituted empty lists for failures.

Character creation now loads its eight categories through one authenticated, account-scoped, coalesced request. It uses metadata-validated prepared components, preserves stable identities and normalized rules, and filters active Workshop lineages. It excludes monster/item sources and redundant raw editor copies. Failed loads show an explicit retry action; retry preserves the draft and previously loaded choices.

Prepared catalogue reads use larger bounded cursor batches and a realistic overall deadline. Lean MongoDB reads are validated as either Buffer or BSON Binary; regression tests cover actual BSON Binary objects, invalid bounds, and cursor cleanup. Raw pack reads batch the first chunks of twelve exact owner/version-guarded sources, while subsequent chunks retain bounded concurrency.

Live verification also exposed a separate monster-detail bottleneck: fetching the entire saved monster-enrichment collection timed out. The reader now projects only the distinct requested supplement keys. Saved enrichment, rules, and token metadata remain intact.

## Verification

- Scoped repository suite: **445 passed, 53 skipped, zero failures**. Existing stale source-resolution mocks and an equipment-identity expectation were aligned with the verified production baseline.
- Frontend production build and server typecheck passed. Vercel also completed its production build and typecheck.
- A disposable local MongoDB replay loaded all 126 retained fixture packs, prepared every category, and exercised the real Express creation-options and Compendium endpoints. The unique local test database was dropped afterward.
- Authenticated staging and public-site checks used the actual account. Every endpoint below returned HTTP 200.
- Browser checks confirmed Imported race/class filtering, Aarakocra selection and traits, Artificer features and subclass options, full feature prose, imported spell prose, and monster statblocks. Retry cleared the warning without changing the original draft. Staging selection checks were followed by restoration of that draft.
- A known saved imported monster supplement returned its rules and token metadata after the projection change.
- All **370 uploaded source files** matched the audited release manifest. Only twelve repair source files differed from the exact previous production baseline. The checkout was reconciled with that baseline in `da5eeab` before the repair; unrelated local extension work was excluded from deployment.
- No API error logs were observed for the final deployment in the checked release window.

Public-site creation catalogue (imported active choices):

| Category | Count |
| --- | ---: |
| Races | 102 |
| Classes | 36 |
| Backgrounds | 74 |
| Subraces | 244 |
| Subclasses | 300 |
| Feats | 228 |
| Languages | 36 |
| Spells | 316 |

Public-site Compendium totals: 635 spells, 111 races, 48 classes, 5,956 monsters, and 5,802 magic items, including the account's personal item. These totals include standard rules and source variants, so they intentionally differ from the creation catalogue.

Observed public timings: creation catalogue 5.9 seconds; small categories about 1 second; cold monster and magic-item lists 12.5 and 9.7 seconds; saved monster supplement 1.5 seconds. These are single-session observations, not a load-test guarantee. Optional persisted-index reads/writes still emitted timeout warnings on large categories; the verified prepared-component fallback returned complete lists successfully. Wider concurrency and long-term cache persistence remain unmeasured.

Campaign notes, imported pack source documents, and saved characters were not edited. Normal read paths may write disposable derived caches.

Local evidence is retained under `.preview.local/library-recovery-20261027/` (`audit.json`, `checks.json`, `production-checks.json`, `local-integration.json`, baseline and source manifests). Full test results are in `backups/library-recovery-2026-10-27-tests.json`. These evidence directories are ignored by Git.

## Release and backup notes

Promotion succeeded; the API returned an empty response that the local helper initially tried to parse as JSON. The public alias was independently inspected and confirmed to point to the released deployment before public verification. No duplicate promotion was attempted.

Git origin is configured, but a push to a separate backup branch was blocked by missing GitHub credentials. The repair remains committed locally. The existing remote rollout branch also contains an independent commit; it was not overwritten or force-pushed.

Rollback means promoting the exact prior deployment identified above. This repair changes no source-data schema and requires no campaign-data rollback.

# Character-sheet loading and first-read work — 28 October 2026

The user authorized sequential loading improvements, with calculations before commitments and desktop correctness prioritized. This batch targets verified database work and repeat owner-sheet reference loading. It preserves server originals and introduces no billing, infrastructure or schema change. Unrelated extension/editor work is excluded.

## Measurements before release

On the authenticated public site, a saved character opened in **1.01 s**. Its complete reference refresh took **13.70 s**, including a **10.655 s** reference request and subsequent equipment/class lookups. The saved sheet was already usable during this refresh. These are separate milestones; 13.70 s is not the time before any sheet appears.

Twelve alternating, same-deployment, read-only database comparisons used the real 126-pack library. Each group/variant ran three times. The probe allowed only its dedicated validation account to read one fixed, previously authorized source owner and returned numeric metadata and SHA-256, without source definitions or writes. Every complete result hash matched and metadata remained stable.

| Direct component read | Baseline median | Grouped-empty experiment median | Difference |
| --- | ---: | ---: | ---: |
| Six character-rule categories | 8,907 ms | 7,084 ms | 1,823 ms / 20.5% |
| Monsters | 7,945 ms | 7,344 ms | 601 ms / 7.6% |

These are direct reader measurements, not full UI timings. Diagnostic deployment `dpl_HkSebezRipjos1sEwGyy3rCTJUHW` must never be promoted. The retained reader uses grouping only with at least 32 declared-empty catalogue slots: the measured 126-pack monster case has only 14 and therefore keeps its original single object scan. **Do not attribute the experimental 601 ms monster gain to the release.** Requested-category manifest projection is retained for both paths; its independent hosted gain has not been established.

The character-rule path reconstructs only actual empty chunks whose payload, digest, part and part count match the known encoding. Manifest counts and stored flags cannot prove emptiness. Raw nonmatching chunks remain in the same aggregation cursor and undergo the original completeness, checksum, byte, entry, deadline and repair checks. Explicit ObjectId casting preserves owner scope in Mongo aggregation. Small libraries, more than 4,096 manifests or over 512 KiB of generation strings use the original scan, keeping grouped BSON arrays bounded.

Eleven actual loopback-Mongo equivalence cases passed: complete replay, missing empty object, corrupt payload, wrong digest, missing part count, forged persisted proof fields, alternate valid gzip bytes, extra chunk, false count, foreign-owner collision and small-library fallback. Complete 126-pack output hashes matched the original reader. No hosted data was mutated by these tests.

A separate transient browser module tested the proposed persistence on the existing authenticated public origin. The real response was 82,939 JSON bytes. After each fresh quick-sheet authorization/version read, the exact compact reference response was recovered from IndexedDB in **1 / 2 / 1 ms**. The warm server reference request during that experiment took **1,425 ms**; fresh quick reads took **1,007 / 1,227 / 1,144 ms**. This is a storage-path test, not full application rendering. It establishes equality and disk cost; it does not turn the earlier cold response into an equivalent warm comparison.

Before implementation, removing the earlier 10.655 s reference request from the 13.70 s refresh suggested approximately **3.1 s** remaining after allowing 100 ms for optional storage. That is an estimate, not an achieved whole-page result. Standard equipment/class requests remain separate.

Raw evidence is ignored under `.local/first-load-20261028/`: `hosted-results.json`, `equivalence-results.json`, and `browser-disk-results.json`. BSON projection accounting from local prototypes is not compressed Mongo wire traffic; the existing connection already negotiates zlib.

## Browser reuse boundaries

Only ordinary owner-sheet references persist. Room, champion and preview responses retain their existing session behavior. Admission requires a successful fresh authorized quick read that supplies the exact account, path, role, saved-character version and library revision. Failed reads or missing revisions cannot admit disk data. A response arriving after an account change cannot populate the sheet.

The device copy excludes the original import document and is bounded to 24 entries, 4 MiB total and 24 hours. One current version per owner/character is retained; another owner's records are removed on write. Each payload has a SHA-256 and basic shape/identity validation. The complete optional disk/hash path waits at most 100 ms before normal authenticated server fallback. Quota errors, blocked storage, eviction, corruption, stale identities and expiry all miss safely. First visits still fetch references.

Logout, login/account changes and explicit rule refresh clear memory and disk reuse and cancel older writes. Other tabs receive an invalidation marker. Initial successful authentication preserves the disk copy, but cannot use it before a fresh authorized sheet check. Ordinary owner-sheet focus refresh still validates the quick sheet; unchanged definitions are no longer refetched merely because focus returned. Publication and Retry force a reference fetch. Existing mutation, scope, saved-version and editing guards remain in place before resolved character values are applied.

## Release validation

The candidate freezes **383 runtime source files**, seven changed from live deployment `dpl_uKqeFbgbz4Ucy6znmSMYEHVCuwP8`. Diagnostic endpoints and unrelated dirty work are absent. Production build, frontend/backend typechecks, 47 focused frozen-source tests and the complete working-checkout suite passed (**534 passed / 55 existing opt-in skips**).

The reviewed deployment is `dpl_9pVoeYF37sCpbVocZWBZJNyL7ZaZ`, initially unaliased and subsequently promoted. Its exact 383-file source audit passed. Hosted browser verification and promotion are recorded below.

Thirteen direct-HTTPS Edge application checks passed: first reference download; two full-document cache revisits with fresh quick reads; damaged-copy fallback; changed-character invalidation; changed-library invalidation with updated definition text; forced publication refresh; unchanged focus validation without reference refetch; blocked and stalled IndexedDB fallback; denied quick authorization with no cached sheet rendered; authorized recovery; and logout deletion. These used a small dedicated synthetic account, and all created characters/packs were removed afterward. Repeat readiness varied from 1.79 to 5.44 s despite zero reference requests, so these small-fixture observations are **not** a demonstrated multi-second 126-pack whole-page gain.

Separate native IndexedDB tests verified 24-entry eviction, a 4 MiB budget (five larger records totaling 4,004,330 bytes), owner replacement and cross-tab invalidation of an older in-flight disk read. Evidence is retained under `.local/sheet-loading-release-20261028/` alongside frozen-source build/typecheck/test logs, source audit, browser checks and release guards.

## Live rollout

Runtime commit `d52a231` was pushed to `origin/codex/folio-sheet-rollout`. The reviewed deployment was promoted to `https://dndoldal.vercel.app`; rollback is `dpl_uKqeFbgbz4Ucy6znmSMYEHVCuwP8`. The immediate alias read still showed the prior deployment; a later read independently confirmed the new target, without repeating the promotion mutation.

Public desktop Edge checks passed for explicit local magic-item saving, revision-only full-document revisit, request-free search, server detail opening and removal, with no page errors. The authenticated real owner sheet also opened without alerts: initial post-promotion saved-sheet times were 1.27 and 0.97 s, with complete references in 0.84 and 0.91 s and zero reference endpoint calls. These first two observations used the browser copy populated by the earlier isolated storage test.

The disposable loopback 126-pack fixture was removed after verification. Synthetic hosted test characters/packs were removed. Production source definitions, characters and campaign data were not changed by validation.

For a final same-release application check, only the selected character's browser reference copy was removed. The next full-document opening fetched references normally and the application saved them itself; the following visit reused that copy without manual seeding:

| Live milestone | Without device references | Next full-document revisit |
| --- | ---: | ---: |
| Saved sheet | 1.19 s | 1.33 s |
| Complete reference refresh after saved sheet | 10.86 s | 0.97 s |
| Reference endpoint request | 9,300 ms | None |

This sequential observation saves **9.89 s / 91.1%** of the measured reference-refresh phase. Other SRD requests also varied between samples, so that entire difference cannot be assigned solely to IndexedDB. It is not a claim about every character or browser, and initial uncached references remain slow. The two reported phases exclude startup before the quick-sheet request; adding them does not produce a complete navigation benchmark. No alerts appeared. Sanitized evidence is `public-sheet-results.json` in the release directory.

Five durable regression cases were added after rollout for grouped proofs, missing chunks, extra/corrupt raw chunks, explicit owner scoping and the generation-byte fallback. These change tests only. The final complete suite passed **539 tests / 55 existing opt-in skips**, including all eight component-reader unit cases. Runtime source still matches the audited deployment.

After measurements, the isolated diagnostic deployment `dpl_HkSebezRipjos1sEwGyy3rCTJUHW` was deleted, removing its temporary cross-owner numeric probe. The public alias was checked before and after and stayed on the reviewed release. The prior live rollback deployment was retained.

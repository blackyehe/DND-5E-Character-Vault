# Notebook toolbar and tag manager — 2026-10-23

Released to https://dndoldal.vercel.app as `dpl_Err4jKzpFwJw7SPk1R9A4rVoZrg8`.
Baseline: `dpl_8db5ZLPuVn8vnDSDmECewJJMHaFr`. The isolated source manifest verified all 311 deployment files, with exactly six changed application files. Other pending root changes were excluded.

- View as, Refresh, and New entry share a 44px control height and lower alignment. Tags sits beside the notebook title so it does not crowd those controls.
- Tags opens a searchable list with usage counts and checkboxes that filter across notebook categories.
- DMs can create unused tags independently of entries. The room catalog stores normalized keys and display names; an atomic bounded update prevents concurrent duplicate names. Names use the existing 48-character rules; the independent catalog supports 500 tags, while entries retain the existing 20-tag limit.
- Existing entry tags remain available without migration. The entry editor offers catalog tags as suggestions.
- Only the DM sees unused catalog tags. Player and player-preview tag names/counts still derive exclusively from accessible entries. Creation requires authenticated DM access and is blocked in preview.

Validation: 45 focused tests passed, frontend production build passed, backend typecheck passed. Disposable browser preview exercised create, entry assignment/save, counts, filtering, and player-preview exclusion. Browser geometry confirmed all three toolbar controls aligned at desktop width and in a 340px notebook container, with no notebook horizontal overflow and a single-column tag panel at narrow width. Browser viewport resize did not change actual viewport dimensions, so narrow verification used the notebook container. Screenshot automation timed out; verification used rendered DOM and element geometry.

Live verification: deployment READY and source hashes verified before promotion; alias checked against the baseline immediately before promotion. Public JSON health returned 200; unauthenticated notebook read returned 401. Authenticated notebook reads returned 200. The live Tags panel and creation form were present; all three controls had identical top coordinates and heights. All 53 entry summaries/revisions and all folder metadata matched the pre-release snapshot exactly (SHA-256 `ad465bb905e4b52e269f46350315235ed5bce75eb8746518699bfe3e264f4b9b`). No campaign content or live test tags were created.

Release evidence: `.preview.local/notebook-tag-manager-20261023/`. The stopped saving-incident monitoring remains stopped.

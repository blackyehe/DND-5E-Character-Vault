# Character ability placement release

Live: https://dndoldal.vercel.app. Deployment `dpl_9cqV9sKADmJTco9R8po8ruJiSZdD`, immutable URL https://dndoldal-4n7gd5rd8-dndenjoyerstudio.vercel.app, Ready in Frankfurt (`fra1`). Public alias and checks verified at 2026-10-24 08:55 UTC.

The six ability scores now sit immediately above Experience in Folio Summary. Classic sheets place their existing ability stack immediately before XP. Shared components cover standalone, dashboard, DM room and player-preview character views. The Folio header now shows character identity without the former ability row. Values, modifiers, score order, responsive rules, XP controls and saved characters are unchanged.

The user explicitly approved publication after reviewing the local preview. Reconstructed from the then-current Compendium grouping release `dpl_2EX8swH8vQbUih8JApGoM5Bh5vUf`, rather than the preview's older baseline. All 359 current production source inputs were verified: 356 byte-identical, only three changed components, no added application paths. The deployed source tree exactly matches all 359 expected SHA1 hashes. The current prepared-reader flags (`prepared`, `*`), grouping schema, server source, source selectors, notebook Gallery and prior changes are preserved.

Changed paths:

- `src/components/sheet/CharacterHeader.vue`
- `src/components/sheet/CharacterSummary.vue`
- `src/components/sheet/CharacterSidebar.vue`

Frontend typecheck/production build and server typecheck pass. Twelve compiled browser checks pass against the reconstructed release: standalone, dashboard, DM room and player preview in both layouts, mobile widths 390/320px, six scores and unchanged modifiers directly preceding Experience, no duplicate header row, no horizontal overflow, no runtime errors and no API writes. Desktop screenshots were inspected.

The hosted stage and public release each passed health/homepage checks, protected character and Compendium API checks (401), removed temporary operator endpoint check (404), login redirects on desktop/mobile, served character/Compendium asset checks, and hosted Folio/Classic placement at desktop/390/320px using disposable API fixtures. These browser placement checks use real hosted assets and local sample character data; they do not claim an authenticated production-character walkthrough. No production character documents were read or saved, and no production data writes were issued. This release does not require derived-data preparation or cache schema changes.

Promotion was guarded by the unchanged live baseline and a Ready stage with exact source hashes. The promotion API succeeded with an empty response body; the public alias was verified before any retry, and no second promotion request was issued. Previous deployment remains available for rollback: promote `dpl_2EX8swH8vQbUih8JApGoM5Bh5vUf` after checking for a newer successor.

The three released components were synchronized into the root and combined worktree only after each original path matched its reviewed pre-change SHA256. All unrelated dirty files were preserved. No Git commit was created across the shared work. The deployment coordinator was notified of the new live baseline.

Evidence: `.preview.local/character-ability-release-20261024/` contains production/expected/published manifests, three-path hashes, reconstruction, source audit, stage/public check reports, promotion record, guarded source-sync record and screenshots. The original approved preview remains under `.preview.local/character-ability-placement-20261024/`; its patch SHA256 is `f1db825f91cbf3e25ffe7d264124132007c4af9775ae62fd9648a806527f3710`.

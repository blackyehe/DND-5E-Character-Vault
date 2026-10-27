# Compendium builders release — 2026-10-23

User reviewed the all-category preview and authorized promotion: “This works, push it live.”

Production: https://dndoldal.vercel.app

Deployment: `dpl_EmvAJ4VcZUCYob7vbfqFRG3yJfjM`, the exact reviewed preview. Previous production: `dpl_EeZAqQqzPGEtTUm8hsk2XKHWVY19`. Immediately before promotion, the live baseline was unchanged and all 343 uploaded source hashes matched the audited candidate. No rebuild from the dirty shared checkout was used.

All 15 categories use prefilled builders from Compendium or Homebrew Workshop, including spells, character options and references. Saving a personal edition preserves explicit per-character review and Apply before existing characters receive revised rules. Source restoration and revision checks remain available. Existing Party, reader/navigation/Grim Harvest, Maps, notebook and Compendium paging changes are preserved.

Validation: 183 tests across 17 files, frontend build/typecheck and server typecheck passed before staging. Browser coverage includes 21 all-category gallery checks, 12 real-editor fixture checks and 11 mechanics checks. After promotion, the main-domain deployment ID was verified; public health returns 200, protected edit/review/browse endpoints return 401 without authentication, and desktop/mobile login and all-category gallery checks pass without production account data writes.

Evidence: `.preview.local/compendium-builders-20261023/{audit.json,published-files.json,validation.json,promotion-output.txt,release.json,gallery-public-browser-results.json}`. Detailed implementation and supported mechanics remain in [the preview record](COMPENDIUM_BUILDERS_PREVIEW_2026-10-23.md).

Vercel reported promotion success; PowerShell classified CLI stderr as NativeCommandError and returned exit 1. The authoritative alias API confirmed the reviewed deployment on the main domain. The collaborative browser snapshot timed out twice, so the existing Edge/Playwright harness completed public UI verification.

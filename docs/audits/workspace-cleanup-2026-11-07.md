# Workspace cleanup and preservation checks - 7 November 2026

Removed 104 reviewed, ignored development-artifact directories after preserving
the working source, an archived production release and a verified private
workspace archive. Application source is unchanged from working-state commit
`add4dd10873f1ae99dda2f5622e4e7e942a9c7be`. This documentation checkpoint is tagged
`recovery/post-cleanup-20261107` on `codex/recovery-checkpoint-20261107`.

## Cleanup scope

- One generated Vitest filesystem transformation cache.
- 61 inactive MongoDB fixture directories.
- 34 obsolete dependency copies; their package manifests and lockfiles remain.
- Eight inactive browser testing profiles.

The removed files total 21,642,897,445 logical bytes. The retained project is
approximately 5.40 GB in decimal units. These measurements skip directory links
to avoid counting linked dependencies repeatedly.

All targets were resolved inside the expected project directories, contained no
tracked source files and contained no directory links. The running MongoDB
service stores its data outside the project and was preserved. All 10,871
fixture/profile files were matched against the private archive's file hashes
before deletion. Main dependencies, source snapshots, campaign exports, local
settings, recovery archives and registered Git worktrees remain available.

## Checks after cleanup

- All 69,972 retained source, report, export and settings files match their
  pre-cleanup SHA-256 fingerprints; none are missing or changed.
- Production frontend build and frontend/backend TypeScript checks pass.
- Default tests: 1,066 passed, 67 skipped or opt-in, zero failed. The filesystem
  transformation cache was disabled during testing so it was not recreated.
- The signed-in account's complete server backup export has identical
  collection-content fingerprints before and after cleanup and the browser
  checks. Exported original source and map-image bytes are included.
- Application collections in all three local non-system databases have
  identical record counts and document-content fingerprints before and after.
- Read-only health, characters, rooms and Workshop API responses match.
- Live read-only browser checks pass for Dashboard, Compendium, Workshop, game
  rooms, the party dashboard, Notebook, Maps and a character sheet. The map image
  loads with its nine locations. No JavaScript errors were captured.
- The saved character-builder draft matches its original hash. Browser
  IndexedDB databases/stores remain available, including the Compendium's 15
  category records and 101 detail records. Derived sheet-reference cache entries
  refreshed during normal navigation; that rebuildable cache is distinct from
  saved characters and drafts.

The optional database integration suites were not newly enabled. These checks
establish source/data preservation and read-only application behavior; they do
not claim a new acceptance pass for every editing or gameplay action. No
production deployment, database migration or campaign edit was performed.

## Recovery and private evidence

The original annotated tags remain unchanged:

- `recovery/working-state-20261107`: validated accumulated working source.
- `recovery/verified-release-20261107`: the 491 archived inputs of the last
  documented verified production release, distinct from the broader working
  source.

Private recovery packages and cleanup evidence are stored outside the project
under `~/ProjectRecovery/dndoldal/`. They include the verified workspace archive,
Git history bundles, source archives, exact deletion manifests, private account
exports, database fingerprints and validation logs. Raw campaign exports,
credentials, browser profiles and private logs must remain outside Git.

The local recovery package is on the same SSD. Retain a separate-drive copy
before removing original private backups or unique archived sources. Code
rollback does not restore database records or browser drafts.

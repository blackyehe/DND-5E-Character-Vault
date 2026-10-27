# Level-up wizard and discovery release — 22 October 2026

The user requested proceeding with the accepted continuation and publishing plan.
Published at https://dndoldal.vercel.app after staged validation and promotion.

## Behaviour

- Publish the accepted six-step level-up wizard, retaining its explicit review,
  frozen character timestamp, Workshop revision check, and existing rules limits
  documented in [the preview notes](LEVEL_UP_PREVIEW.md).
- The Spells & resources finder orders eligible spells by numeric level, then
  name, before the result limit. Cantrips come first when eligible. The same
  ordering applies to additional spell grants and feature spell choices.
- Feat search combines multiple search words with an effect filter and a source
  filter when multiple sources exist. Effects cover ability bonuses, attacks and
  damage, defense and HP, spellcasting, skills and proficiencies, movement and
  utility, and uncategorised entries. All matching feats remain available in the
  native selector; the old arbitrary 60-result truncation is removed.
- Filters preserve the chosen feat even outside the current results. Counts,
  active filter labels, empty results, and Clear filters explain the current
  view. Clearing filters restores focus to search. Native controls retain normal
  keyboard operation, and the result row reserves space to avoid layout jumps.
- Discovery uses structured ability increases and conservative description
  cues. These tags are search aids, not prerequisite validation or automatic
  mechanical effects. Full feat rules still require review.
- Existing typography, theme variables and motion preferences are preserved.
  At phone widths, wizard actions stay in document flow so they cannot cover
  fields while editing.

## Source isolation

The current live baseline was deployment `dpl_HqVqyhnBW3ymmfgacrgkMVfa6QWe`
(`dndoldal-bzoswbsof-dndenjoyerstudio.vercel.app`). Its 270 source hashes matched
the saved notebook-folders release exactly. It included newer notebook and item
import work but had again omitted the already accepted Party and character
folder features.

The release starts from those exact live files and restores the 19 accepted
Party/folder files from the verified character-folders release. Inspection of
overlapping files confirmed missing integration rather than newer competing
behaviour. The wizard overlays only its reviewed application files. Newer
notebook, Maps, imports, monster and other live files are preserved.

There are 287 deployment input files and 30 changed/added files relative to live.
Every dry-run source hash matches the isolated manifest. No source files are
removed. The shared root checkout is not deployed, and no Git commit, PR or
remote Git push is involved.

Ignored local artifacts under `.preview.local/level-up/release/` contain the
exact source, baseline, change manifest, deployment inputs, validation results
and screenshots. Local fixtures, credentials, dependencies and review scripts
are excluded from deployment.

## Validation

- 96 focused advancement, discovery, store, Party and folder regression tests
  passed across 12 test files. Root frontend and server typechecks passed.
- The isolated production build and server typecheck passed.
- Browser verification ran against the compiled release and its local API,
  with 79 synthetic imported feats across two sources. Verified every effect,
  combined search/effect/source filtering, uncategorised entries, no-result
  recovery, reset, selection persistence and keyboard traversal.
- Screenshots reviewed at 1440, 834, 390 and 320 pixels with reduced motion and
  no horizontal overflow. Review corrected explicit control names, reset focus,
  result-row stability and the phone action bar covering fields.
- Real Wizard spells are sorted by level/name; granted-spell results begin with
  cantrips. A genuine HTTP 409 preserved concurrent HP/temp HP changes. Restart
  then successfully advanced a disposable local clone, preserving those values.
- Folder browsing and unauthenticated advancement boundaries passed. No browser
  runtime errors occurred. Temporary local characters and discovery packs were
  removed after verification; no production character writes were performed.
- The previously documented unrelated builder-test Dagger expectation failure
  remains outside this release. The focused checks above pass.

T3 preview status/open/navigation and JavaScript evaluation worked, but repeated
snapshot calls returned `Preview automation snapshot timed out after 15000ms.`
and a focused click also timed out. The available CUA browser inventory was
empty. Screenshots and interaction checks therefore used the existing local
Playwright/Edge review harness as the runtime-permitted fallback.

## Publication

- Ready, promoted deployment: `dpl_9Hs8BL1NAmxnJDEPoQKpfdozSj5t`.
- Deployment URL: https://dndoldal-aez860doz-dndenjoyerstudio.vercel.app.
- Previous live deployment: `dpl_HqVqyhnBW3ymmfgacrgkMVfa6QWe`.
- All 287 uploaded source hashes match the reviewed isolated manifest. The
  public alias was checked for concurrent changes immediately before promotion.
- Staged and public checks passed for HTML, shipped wizard/filter assets,
  restored Party/folder assets, retained notebook folders, health, and
  unauthenticated access boundaries. Desktop/mobile public login rendered
  without overflow or browser runtime errors.
- Authenticated advancement saves were verified on the identical source built
  locally with disposable synthetic data. Production smoke checks were read-only.

Open a character sheet and choose **Level up** to begin. The Spells & resources
step contains ordered spell results; feat filters appear in Abilities & feats
when the target class level grants an ASI and Feat is selected. The Source
filter appears only when the imported catalog contains multiple sources.

### Rollback

```powershell
npx.cmd vercel rollback dpl_HqVqyhnBW3ymmfgacrgkMVfa6QWe --scope dndenjoyerstudio --yes
```

This restores the immediate previous application, including its omitted Party
and character-folder features. No database migration was performed. Saved
advancements and organisation data are not deleted by application rollback.
No rollback has been performed.

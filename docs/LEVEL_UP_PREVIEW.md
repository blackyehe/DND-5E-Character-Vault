# Guided level-up preview

Original scope: two local implementation/review passes. Publication was deferred
until the user subsequently requested proceeding with the continuation plan.

Keep the current appearance palette (obsidian canvas #08090b, paper #141518,
ink #f1edef, muted #c1b9be, line #3b3c43, crimson #be3449), selectable
themes and existing display/body fonts. Use a full sheet-width guided workspace,
left-aligned fields and rule text, aligned before/after values, and one active
step at a time. Six purposeful steps: class, HP, training, features, magic,
review. On phones the progress list wraps above the active step. No new entrance
effects; existing motion and reduced-motion preferences apply.

The distinctive element is the character's actual advancement ledger: earned
features, required choices, and precise before/after changes. Avoid a generic
form wizard that merely asks users to confirm unrelated checkboxes. Save once,
with the original timestamp, and require a deliberate restart after conflicts.

Rules baseline: 2014/SRD 5.1, not 2024. References:
- https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters#Beyond1stLevel
- https://www.dndbeyond.com/sources/dnd/basic-rules-2014/customization-options#Multiclassing
- https://www.dnd5eapi.co/api/2014

Saved homebrew definitions take precedence over matching SRD names. Unknown or
unstructured rules require explicit input and review. Do not present inferred
choices as fully automated rules. Preserve inventory, XP, spent resources,
current/temp HP and death saves unless the user explicitly selects an HP change.

## Working preview, 22 October 2026

Local only; no deployment, commit, or remote publication was performed.

- Frontend: http://127.0.0.1:5180
- Fighter walkthrough: http://127.0.0.1:5180/characters/6ad9e80265a272a7df0cf71f?advance=1
- API: port 4016, explicitly connected to the local `dnd_site` database.
- Isolated source: `.preview.local/level-up/source`, based on the exact accepted
  character-folders release, with only advancement-related changes overlaid.
- Synthetic characters and a synthetic Workshop pack were created locally for
  verification. No production characters or accounts were changed. Test session
  files and credentials remain in ignored local artifacts.

### Pass 1: working advancement

Implemented the six-step wizard inside the existing sheet. It loads a fully
resolved, owned character snapshot and class-specific rules; calculates one
level; collects HP, ASI/feat, subclass, feature, training, and spell choices; and
saves once after an explicit before/after review. Real local Fighter, Wizard,
and Rogue saves verified CON retroactivity, expertise, spell learning, slots,
and preservation of spent state. Nothing is written while filling the steps.

### Pass 2: review and refinement

- Removed the duplicated sheet header and unrelated sheet tabs during the
  walkthrough. A compact Return to sheet action uses the existing draft guard.
- Corrected checkbox/radio alignment, separated interactive rule disclosures
  from labels, added option search, and respected the appearance text scale.
- Fixed mobile overflow from numerical feature data, displaying `3d6 → 4d6`
  instead of raw data. Verified every step at 1440, 834, 390, and 320 pixels,
  including long names, large type, light theme, and reduced motion.
- Added domain spell grants, Magical Secrets, Mystic Arcanum choices and
  trackers, readable progression summaries, and review of existing level-based
  racial/feat rules. Workshop choices retain their stable rule/feature IDs.
- Kept a frozen character timestamp and library revision for the final save.
  A real HTTP 409 preserved another update's current/temp HP. A Workshop rule
  revision also blocked a stale draft with an unchanged character timestamp.
- Verified network-failure retry, duplicate-click protection, draft navigation
  guard, keyboard step focus, and focus restoration after applying.
- Verified unauthenticated and other-owner access boundaries. Permanent
  advancement is absent from player previews and Shadow Champion sheets.

### Validation

- 31 focused progression/rules/store tests passed across
  `shared/level-up.test.ts`, `src/lib/level-up-rules.test.ts`, and
  `src/stores/characters-preview.test.ts`.
- Frontend typecheck and isolated production build passed. Both root and
  isolated server typechecks passed.
- Final real-browser saves also covered an authored Workshop class, Wizard,
  Cleric, Bard, and Warlock. No browser runtime errors occurred in the passing
  runs. Evidence is under `.preview.local/level-up/` (`pass1-results.json`,
  `pass2-results.json`, `advanced-results.json`, and screenshots).
- An additional existing builder suite has one unrelated failure:
  `character-builder.test.ts:71` expects a Dagger without the retained
  `index: 'dagger'`. The same failure was reproduced against the unchanged
  published source. Its implementation and assertion were left untouched.

### Explicit boundaries

This is a 2014/SRD and saved-Workshop advancement preview, not a universal rules
interpreter. Text-only feat effects, racial unlocks, conditional combat bonuses,
and imported choices require review and explicit mechanical grants. The wizard
retains their rules rather than claiming to infer every effect from prose.
New proficiencies, saves, movement, additional features, granted spells, and
resource trackers can be recorded within the walkthrough.

Unstructured imported classes must receive a complete Workshop progression
before guided advancement. Custom multiclass prerequisites, different casting
abilities on one character, and combined Pact Magic/Spellcasting pools are
blocked where the existing sheet cannot safely represent them. Standard
single-caster/noncaster and same-ability Spellcasting progression use the
appropriate class or combined slot tables. Pact rank increases carry spent
uses to the new rank without granting recovery.

No rest is implied. Existing preparations remain; newly earned always-prepared
subclass spells are added as grants. The normal prepared-spell allowance still
excludes those domain/circle grants according to their saved feature rules.
No inventory, XP, current/temp HP, death saves, or spent uses are reset.

## Next session: refinements and later publication

Continuation started on 22 October 2026 following “Proceed with the plans”.
Implementation and release results are recorded in
[the release notes](LEVEL_UP_RELEASE_2026-10-22.md). The checklist below preserves
the originally agreed scope.

The user accepted the current preview as the starting point. This section is a
plan only: no further implementation or deployment is authorised for this
session. Preserve the accepted wizard layout, appearance system, and safe-save
behaviour.

### 1. Spell finder ordering

- In **Spells & resources**, sort the complete eligible spell results by numeric
  level ascending: cantrips first, then levels 1–9. Sort names alphabetically
  within each level. Apply sorting before any result limit or slicing.
- Preserve class eligibility, search, selected-spell exclusions, learning
  allowances, and replacement rules. Keep the spell level visible.
- Check related feature/feat spell pickers and use the same ordering where
  appropriate. Add level grouping only if it improves scanning without clutter.

### 2. Feat discovery filters

- Add compact effect filters alongside the existing search. Initial candidates:
  ability bonuses, attacks/damage, defense/HP, spellcasting,
  skills/proficiencies, and movement/utility.
- Prefer structured metadata. If prose-derived tags are needed, treat them as
  discovery aids, never prerequisite validation or automatic mechanical grants.
- Allow combined search and filters, show active filters, and provide a clear
  reset action and useful empty-results state. Keep uncategorised/imported
  feats discoverable. Consider ability-increased and source filters only where
  the available metadata supports reliable results.
- Preserve feat prerequisites, selection limits, rules disclosures, and manual
  review of text-only effects. Respect keyboard, mobile, and text-scale needs.

### 3. Local review and validation

- Make one focused refinement/review pass against actual caster and noncaster
  walkthroughs, imported feats, mixed spell levels, combined filters, empty
  results/reset, keyboard use, and mobile layouts.
- Add focused checks for ordering before truncation and meaningful filter
  behaviour. Run progression/rules/store tests, typechecks, and an isolated
  production build; smoke-check save, conflict handling, and return to sheet.
- Retain the documented unrelated builder-test failure unless its cause changes;
  do not silently broaden this release to fix unrelated work.

### 4. Prepare a controlled release in the later session

- Recheck the actual live deployment and source revision before assembling the
  release. The root checkout contains unrelated ongoing work and must not be
  deployed wholesale.
- Last accepted baseline: deployment `dpl_heD3Sm813eH73asSXWjun5yLg6dz`, source
  `.preview.local/character-folders-release-20261022/source`, manifest
  `.preview.local/character-folders-release-20261022/published-files.json`.
  These are reference points, not a guarantee that live remains unchanged.
- Start from the then-current accepted live source, reconcile newer accepted
  changes, and overlay the reviewed wizard and discovery refinements. Use
  `.preview.local/level-up/source` and its sync helper as local references.
  Review the exact release diff and preserve existing Party, folders, monster,
  and other accepted updates.
- Publish only when requested in the later session. Retain the previous
  deployment for rollback. After release, verify navigation, spell ordering,
  feat filtering, choices, return to sheet, and a representative advancement
  using safe test data. Keep credentials out of tracked documentation.

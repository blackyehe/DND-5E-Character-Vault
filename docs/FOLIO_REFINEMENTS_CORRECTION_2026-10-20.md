# Folio refinements: final correction and publication authorization

## User decision

After reviewing the staged refinements, the user clarified that Summary must show every standard skill, as in Proficiencies, and that long imported weapon proficiency lists must use the existing simple/martial consolidation rule.

The user then explicitly authorized fixing these issues and publishing without another preview, provided rollback remains available. This supersedes the pending approval described in `FOLIO_REFINEMENTS_STAGE_RECORD_2026-10-20.md`.

## Final corrections

- Summary lists all 18 standard skills, including untrained skills, with ability, proficiency/expertise status and the same modifier calculation used by Proficiencies.
- Summary, Proficiencies and the Classic sidebar reuse `compactWeaponProficiencies`: more than 20 distinct weapon entries display as “All simple weapons” and “All martial weapons”. This also covers older saved records without rewriting character data.
- The other refinements in `ac33cdd` are included: compact statistics, full-width Combat vitals, death saves visible only at zero HP, and collapsible sections with six-entry feature columns.

Frontend type checking and the production build pass. No automated test suite, database migration or character/resource write was performed.

## Rollback

The previous live Folio deployment remains the rollback target: `dpl_6xEEVqQmcqw3dXLACrAoyyEUWiP7` (application commit `46ccd37`). Git tag `pre-folio-refinements-2026-10-20` retains the same application plus its release documentation at `22536d2`.

The older staged deployment `dpl_4Jqq8rcqY5CWjoAW6Mn7biGBXnpd` does not contain these final corrections and must not be promoted as the completed release. Record the new deployment identifier after publication.

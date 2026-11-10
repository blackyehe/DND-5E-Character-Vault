# Level-up spell selection

The user requests a better spell chooser: missing spells restored, sorting, and
per-spell expandable rules instead of a detached inspection/Learn panel at the
bottom. Existing standing preference requires quick layout options before UI
implementation. The HTML compares two variants within the selected C surfaces:

- A: open a row, read its rules and Learn inside that row.
- B: same expansion, with a separate always-visible Learn button beside the row.

Design plan: retain current theme-derived C headers/inset bodies and Barlow
typography in the application. The example uses the current Obsidian/Crimson
palette (paper #1a161a, soft #36242a, field #130f13, ink #f1edef, accent #be3449).
Search, level/name/source sort, spell-level filter, explicit counts/paging and
preserved selections make availability and the draft allowance clear. Details
and selection stay at the spell; no unrelated layout or theme settings. On phones,
controls wrap and B's action moves below the row. Distinct source versions remain
labelled. Spell text and character values are illustrative; no saves/API calls.

Confirmed code findings in LevelUpWizard.vue:

- Ordinary results silently truncate at 40; additional grants truncate at 30.
  Neither list offers paging. Sorting is fixed to ascending level/name.
- Standard-class membership is taken from srd.classSpells. Imported spell IDs are
  then tested against that SRD list; a class-compatible imported version can be
  excluded. The advancement-options payload strips class metadata from imported
  spells, preventing the client from resolving that membership from saved fields.
- Class/level limits and existing-known/chosen exclusions are also applied.
  Those are legitimate restrictions and must not be bypassed to expose results.
- A single spellDetail/grantDetail is rendered below the result buttons; definition
  requests use global busy state rather than independent per-row expansion.

Implementation after selection: use visible paging/counts rather than silent
caps, add sorting and inline lazy-loaded rule details to both ordinary and grant
choosers, preserve draft choices while filtering, retain saved-source identities
and alias matching, and include the minimum class/source metadata required for
correct eligibility. Keep explicit Workshop lists, subclass extras, allowance
limits and the final stale-character/library guards authoritative. Do not turn
every library spell into an eligible class spell or fetch every full definition
up front. Explain unavailable definitions/source-load failures with retry.

The user selected A. The implementation shares one inline chooser between class
learning and additional grants, with independent lazy rule requests, explicit
paging/counts, sorting and preserved selections. Special feature spell lists also
include imported definitions and expose Show more for long option lists. See
`docs/audits/level-up-spells-2026-11-10.md` for validation and release boundaries.

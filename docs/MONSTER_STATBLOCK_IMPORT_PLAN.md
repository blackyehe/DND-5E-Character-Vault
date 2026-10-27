# Monster statblock import proposal

Status: design only; no importer, schema change, account write, or deployment implemented.

## Goal and scope

Add **Import statblock** beside Create monster in Monster Workshop. Pasted text,
copied HTML, or a screenshot becomes an editable creature draft with a review of
extraction uncertainty, existing creatures with matching names, and unavailable
references. Publishing uses the existing owner-scoped pack save flow.

Start with pasted text/copied HTML. Add screenshot recognition as an input adapter
to the same parser. A URL fetcher is a separate adapter, not a requirement for
importing the supplied screenshot. A screenshot contains no original link targets.

Here, unavailable information includes missing or ambiguous referenced rules,
references from a different edition, failed lookups, unreadable source regions,
and fields the current editor cannot represent. These need different messages.

## Findings in this repository

- `shared/monster-workshop.ts` already models editable statistics, named rules,
  all eight rule sections, section introductions and end notes. `MonsterAction`
  supports literal text as well as generated attack/save descriptions.
- `shared/monster-statblock.ts` provides a read-only representation with nullable
  missing statistics. This is a better starting point for incomplete extraction
  than `newMonsterDraft()`, whose example values could invent missing statistics.
- `MonsterWorkshop.vue` already provides draft persistence, preview and review/save.
- `/api/monster-workshop/library` returns editable native creatures only. Its
  `monsters` array is insufficient for collision checking against imported packs.
- `workshopLibrary()` exposes the active imported monster catalog; raw parsed
  pack entries are also available for checking disabled entries separately.
- `server/data/srd-2014-compendium-index.json` includes Aboleth. A local name
  collision is confirmed. Account-specific duplicates were not inspected.
- Existing pack/content hashes detect identical files or content under existing
  keys; UUID creature keys protect identity. These are not name-collision checks.
- Local full definitions include spells, equipment and magic items. Full standard
  monster descriptions use the configured SRD service; the local monster index
  can still report a name collision if that service is unavailable.
- A local Project Image spell exists, but its source is SRD 2014. This does not
  establish that it is a matching definition for the screenshot's 2025 source.
- `MonsterRuleText.vue` currently formats text; it does not resolve rule links.

## Expected result for the supplied Aboleth

Extract identity, AC 17, HP 150 with 20d10 + 40, walking 10 ft., swimming 40 ft.,
all six scores and the separate modifier/save columns, listed skills, senses,
languages, telepathy, CR 10, PB +4, and the complete rule sections. Expect five
traits, four actions, two legendary actions and two named regional effects,
plus the legendary introduction and regional introduction/ending.

Preserve source text naming MM'25 page 12 and SRD 5.2.1; do not expand unknown
source abbreviations or assume external source availability from that footer.

The current draft/statblock/compiler/reader/export paths have no dedicated fields
for these values:

- Initiative +7 and its displayed fixed result 17. Do not replace it with the
  Dexterity modifier (-1), or infer a proficiency formula from the result.
- Lair XP 7,200 alongside the ordinary XP 5,900.
- Habitat and treasure classifications.
- Structured source edition, page, import provenance and reference resolution.

The existing rule text/usage fields can retain conditional legendary resistance
and legendary action allowances (3 normally, 4 in a lair). Do not flatten these
to a single allowance. Regional effects do not establish a missing lair-action
section; do not invent one.

Arithmetic checks pass for the visible HP (150), Tentacle damage (12), History
(+12 using expertise), Perception (+10 using expertise), and passive Perception
(20). Preserve the printed values when a future input disagrees with a formula,
then flag the discrepancy; never silently correct source material.

## Extraction pipeline

1. Retain bounded original input, source metadata, parser version and input hash.
   For screenshots, retain an explicit user-controlled image reference or a
   downloadable original rather than relying on a temporary attachment path.
2. Normalize whitespace, minus signs, dice notation and headings while preserving
   original character ranges. Copied HTML is parsed as inert data, never executed.
3. Split identity, headline statistics, abilities, properties and named sections.
   Image extraction must retain positions: the screenshot has three ability
   tables with two rows each, not six abilities in ordinary left-to-right order.
4. Produce partial fields and rules with evidence ranges, extraction confidence
   where supplied by the extractor, and explicit missing/ambiguous states.
5. Preserve multiline feature bodies, usage labels, section introductions and
   endings. Do not split a feature on every sentence or every colon.
6. Validate ranges, HP/damage arithmetic, ability modifiers, save/skill bonuses,
   and internal references such as Lash -> Tentacle and Multiattack -> named actions.
7. Run name/content comparison and external-reference resolution independently.
8. Show the source alongside the actual statblock preview and the review issues.
   Edits invalidate affected checks. Recheck account data on final save.

Default imported rules to literal text. Opt into structured attacks/saves only
when their complete meaning can round-trip unchanged. In particular, the current
attack generator says "Melee Weapon Attack", whereas the screenshot says "Melee
Attack Roll"; converting it blindly would rewrite the source. Spellcasting overrides
such as DC 16 remain explicit even when an inferred formula would differ.

## Name and content collisions

Build candidates from the shipped standard index, all account monster packs,
and local drafts supplied by the browser. Label disabled candidates as disabled.
If a pack cannot be read, report that the search is incomplete.

Use Unicode normalization, case folding and whitespace normalization for exact
name matching. Use punctuation-insensitive and fuzzy matching only to suggest
possible matches; never use fuzzy matching to choose an overwrite target.

Compare parsed mechanics/content separately from identity and presentation.
The existing canonical hash includes content keys and native editor metadata, so
it is not sufficient for detecting the same creature imported with a new UUID.
Do not discard usage clauses or rule prose from a semantic comparison.

Distinguish identical reimports, same-name/different-source variants, changed
definitions of an owned native monster, and similar names. For this screenshot,
show **Aboleth — SRD 2014** and **Aboleth — MM'25 / SRD 5.2.1** as distinct source
versions. Missing edition metadata should be displayed as unknown.

Offer Skip, Keep as separate version, Rename, or Update selected owned native
monster. Default to a separate version for this case. Standard definitions and
arbitrary imported entries are not eligible for in-place native editing.
Updating requires explicit target selection and the existing expected pack hash,
creature revision and atomic write check. Retain an import identity/hash so retries
and identical reimports do not accidentally create extra copies.

## Unavailable references and rule clashes

Recognize candidate references by context/type, not blue text or capitalization
alone. Candidates here include Project Image, Charmed, Grappled, Poisoned and
Emanation. Hit Points and damage types need not become external dependencies.

Each reference records its original label, rule kind, requested source/edition,
candidate identities and one of these distinct outcomes:

- Resolved to the selected source/edition.
- Defined within the imported monster itself.
- Multiple plausible matches: selection required.
- Available only in another edition: explicit fallback choice required.
- Name/index known, but complete definition unavailable.
- Missing from the searched libraries.
- Lookup failed or temporarily unavailable: retry offered; not proof of absence.
- No target can be recovered from the input, or library search was incomplete.

Keep full imported prose visible even when a referenced spell is unavailable.
Never fill a 2025 rule silently from the 2014 library. The regional Project Image
effect also supplies its own range/components/DC overrides; resolving the spell
must retain those overrides. External source URLs remain citations, not proof
that the website has an accessible local definition.

Check internal references separately: a missing Tentacle action is a broken
within-monster reference, not a missing spell. Detect contradictory duplicate
fields, cropped descriptions and unconsumed text. Every source segment should
be mapped, deliberately retained as a note, or visibly reported as unparsed.

Unresolved supplemental links are warnings and may be saved as plain text.
Unreadable required statistics and known data loss block publication until
corrected or explicitly represented as unknown in a supported schema. A draft
and original input can always be retained for later work.

## Proposed integration

- `shared/monster-import.ts`: typed partial extraction result, evidence, issues,
  references, parser and pure consistency checks.
- `server/lib/monster-import-review.ts`: account-scoped candidate lookup and
  version-aware reference review using existing library and SRD services.
- `POST /api/monster-workshop/import/preview`: parse/review without publishing.
- Extend the existing publish path with import identity, collision decisions and
  fresh validation; never trust a stale preview or client-only collision result.
- `src/components/monsters/MonsterImport.vue`: source input, editable extraction,
  source/preview comparison, issue navigation and duplicate decisions.
- Extend draft, validation, statblock, native pack mapping and every export path
  together for initiative, contextual XP, classifications and provenance. Keep
  old version-1 drafts readable through optional fields or an explicit migration.
  The current strict backend schema must be updated along with the frontend.

An image/OCR adapter needs an explicit implementation choice and dependency;
the application currently has no OCR dependency. Text parsing should remain
usable without an OCR service. Source-link fetching, if later added, must bound
redirects/time/size and reject private-network destinations.

## Acceptance checks

Use a transcription of the supplied input as a deterministic parser fixture;
also exercise the actual image adapter when added. Verify all six score/mod/save
columns, multiline descriptions, conditional lair rules, section order and every
footer field. Test cropped input, OCR confusions, duplicate names across editions,
identical reimport, disabled/unreadable packs, ambiguous spells, unavailable
services, broken internal action references and changes between preview/save.

Round-trip through validation -> draft -> compile -> pack -> read-back -> exports
must retain every accepted field and clause. Keep existing saved creatures and
reusable action copies independent. No account data was modified for this design.

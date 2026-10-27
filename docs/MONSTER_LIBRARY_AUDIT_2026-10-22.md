# Monster library audit — 22 October 2026

Status: completed, read-only. No application implementation, monster import, account write, deployment, or T3 restart.

## Conclusion

Extend the current Monster Workshop. Its statistics editor, literal rules, eight rule sections, compiler, preview, pack storage, and revision checks provide a sound base. The work needed is import fidelity, source-aware identity, reference resolution, and a review screen.

A general 5etools importer cannot safely map every creature directly into today's draft schema. Some values require schema extensions; others can already be preserved in literal rule text. A replacement builder or a complete combat automation engine is unnecessary.

## Current signed-in library

These counts come from authenticated production GETs, after sign-in, rather than inferred access to an older backup.

| Library | Current entries | Notes |
|---|---:|---|
| Standard monster index | 334 | SRD 2014; full descriptions use the standard API |
| Active imported monsters | 680 | All from all-content.orcbrew |
| Distinct imported names | 666 | 14 groups have two same-name entries |
| Native editable Workshop monsters | 0 | The native library alone would miss every imported creature |
| Combined distinct monster names | 996 | Four names overlap between the standard and imported libraries |
| Imported spells | 316 | Full descriptions present in the active catalog |
| Standard spells | 319 | Shipped SRD 2014 definitions |
| Separate custom spell documents | 0 | Checked independently |

Both saved packs were readable. Blacky's Book of Shadows2.orcbrew reports zero monsters. The Workshop library reported no warnings.

The all-content pack reports 42 disabled entries, 10 duplicates, and two non-finite values **across all content kinds**. These are not monster-specific counts. Its live normalized source hash matches the October 18 backup exactly; parsing that same source found 680 raw monsters and zero disabled monsters. Thus no additional disabled monsters are concealed by the active monster endpoint. The other pack currently reports zero monsters. No pack settings were changed.

Forty-three monsters lack an original CR. Many are summoned or scaling creatures; absence of CR does not establish corruption. The old catalog supplies fallback zeroes, so comparison used the original details field. The existing statblock reader already avoids displaying an absent CR as a genuine CR 0.

## Name clashes

The public scan covered all 112 files in the [bestiary source index](https://5e.tools/data/bestiary/index.json): 4,574 base entries, plus 368 generated versions resolved with the site's own loader. There were no failed source fetches. This scope includes multiple editions, reprints, adventures, and source variants.

| Comparison | Result |
|---|---:|
| Public base entries with a name present locally | 1,466 |
| Local distinct names matching a public base name | 828 of 996 |
| Local distinct names matching after generated versions | 840 of 996 |
| Public distinct base names | 3,824 |
| Public same-name groups | 714 |

For the 503 entries in the newer Monster Manual source, XMM:

| Existing name candidate | Entries |
|---|---:|
| Standard library | 277 |
| Imported library | 88 |
| Either library | **365** |
| No exact local name match | **138** |

These are normalized **name matches**, not identical-creature findings or permission to overwrite. Normalization uses NFKC, case folding, trimmed/collapsed whitespace. It does not merge typos or strip punctuation. The 138 entries may still have renamed or similar-name counterparts.

The complete XMM review list is in [monster-xmm-name-review-2026-10-22.csv](audits/monster-xmm-name-review-2026-10-22.csv). Each name match retains the existing source label.

All 14 duplicate-name groups in the imported library are source/version candidates: Aberrant Spirit, Alchemical Homunculus, Bestial Spirit, Celestial Spirit, Dancing Item, Elemental Spirit, Fey Spirit, Fiendish Spirit, Homunculus Servant, Iron Defender, Shadow Spirit, Steel Defender, Undead Spirit, and Wildfire Spirit. Their details are in the JSON evidence.

Potential spelling suggestions include Aarakroca → Aarakocra, Pteradon → Pteranodon, Nyacaloth → Nycaloth, Storm Giant Quintessant → Storm Giant Quintessent, and Titivllus → Titivilus. These require review; do not automatically rename or select overwrite targets.

### Confirmed version example: Aboleth

The current standard detail endpoint returned HTTP 200 and HP 135. The newer [XMM Aboleth](https://5e.tools/bestiary.html#aboleth_xmm) has HP 150 and contextual lair XP 7,200. Shared name, CR 10, and AC 17 do not make these the same version. Keep them source-qualified.

## Existing imports needing statistic review

Explicitly mapped seven unambiguous source labels to their public IDs: MM, TCE, VGM, MTF, GGR, ERLW, and FTD. This produced 523 name-and-source comparison pairs.

Compared original CR, numeric average HP, a single unambiguous numeric AC, six ability scores, saves, and skills. Normalized skill hyphens/spaces and signed numeric notation. Did not force scaling formulas into fixed numbers.

| Result | Pairs |
|---|---:|
| At least one selected-field difference | **53** |
| No detected difference in the compared fields | 470 |

The 470 are not certified identical: prose, alternate AC, formula behavior, spell lists, defenses, and other fields were not fully compared.

| Field with a difference | Pairs |
|---|---:|
| CR | 5 |
| HP | 8 |
| AC | 1 |
| Ability scores | 10 |
| Saves | 16 |
| Skills | 24 |

A pair can differ in several fields. The [53-entry statistic review CSV](audits/monster-stat-review-2026-10-22.csv) includes the compared values.

Examples:

- Demilich, MM: the current import has HP 50 and CR 19; the public entry has HP 80 and base CR 18, with lair CR 20.
- Arcanaloth, MM: imported Deception and Insight are +9; the public entry lists +11.
- Clawfoot, ERLW: imported CHA 6 versus CHA 10.
- Adult Blue Dracolich, MM: HP/AC/CR agree, while saves and skills differ.

These are review candidates, not an automatic correction list. A difference may reflect transcription, errata, customization, source revision, or a fixed value replacing a formula. The public site was used for comparison, not declared authoritative for every owned entry.

Within the matched pairs, 15 public entries use special HP formulas and 11 use special AC formulas; they overlap and were treated separately from numeric HP/AC equality. Six UA source labels had no confidently established mapping to a current source in this scan. Unmatched names or sources remain unverified.

### Formula fidelity example: Aberrant Spirit

The current TCE import yields HP 43 from 6d10 + 10 and AC 15; its armor note still refers to spell level. The [public TCE entry](https://5e.tools/bestiary.html#aberrant%20spirit_tce) defines HP and AC as spell-level formulas. There is also a separate UA same-name import with different fixed values.

Retain the formula and its required casting context. A formula cannot be faithfully represented by choosing an arbitrary fixed HP and putting only the explanation in a note.

## Referenced information and availability

Audited tagged references from the resolved base monsters, using source-qualified, case-insensitive identities. Resolved inheritance and generated content with the site's loader to avoid false missing-reference reports.

| Check | Result |
|---|---|
| Raw inheritance parents | All 1,144 resolved |
| Spell source files | All 18 loaded; 969 definitions |
| Canonical spell reference targets | 580; all found on the source site |
| Creature reference targets | 163; all found after resolving generated versions |
| Legendary group dependencies | No confirmed unresolved dependency |

Umbraxakar initially points to a group absent from the raw group file. It resolves to a runtime-generated Shadow Dragon group. It is not a broken link.

For local spell names, 22 source-qualified targets lack an exact name. Nineteen have explicit SRD aliases supplied by the source data, such as Bigby's Hand → Arcane Hand. After considering those aliases, three names are absent from the current standard and imported spell libraries:

- Elementalism
- Befuddlement
- Jallarzi's Storm of Radiance

All three have XPHB definitions on 5etools. Their issue is local availability, not an unreachable source website.

There are 206 distinct XPHB spell reference identities across the scanned monsters. A 2014 same-name spell or SRD alias does not prove the correct newer-edition definition is installed. Resolve by type, source/edition, and identity; allow an older-edition fallback only as an explicit review decision.

Item, condition, disease, status, action, sense, skill, and variant-rule definitions were not exhaustively resolved. No claim is made that every hyperlink or external reference on the site is usable locally. Unsaved browser-only drafts and uninstalled homebrew were outside the audit.

## The requested Aarakocra Aeromancer

The [linked XMM Aeromancer](https://5e.tools/bestiary.html#aarakocra%20aeromancer_xmm) has no exact current local name match. Aarakroca is a different older creature and should only appear as a similar-name suggestion.

The existing builder can retain its basic statistics and rule prose. The importer must additionally preserve:

- Spellcasting in Actions, with Feather Fall in Reactions.
- All six source-qualified XPHB spell references, their frequencies, and casting overrides.
- The printed spell save DC 13; WIS 17 and PB +2 are not permission to recalculate it to 15.
- Wind Staff's combined melee/ranged targeting and two typed damage components.
- Habitat, treasure, source edition/page, and import provenance.

Elementalism is absent locally. The other five names have older local definitions, which is insufficient to mark their XPHB references resolved.

## Builder coverage and required upgrades

Repository evidence: [draft/compiler](../shared/monster-workshop.ts), [reader model](../shared/monster-statblock.ts), [strict backend schema](../server/lib/monster-workshop-schema.ts), [pack mapping](../server/lib/monster-pack.ts), [save routes](../server/routes/monster-workshop.ts), [rule renderer](../src/components/monsters/MonsterRuleText.vue), and [exports](../src/lib/monster-export.ts).

Already available: six abilities, HP dice/override, a single AC calculation, movement plus custom movement text, save/skill overrides, defenses, senses, telepathy, eight rule sections, introductions/end notes, literal text rules, preview, and revision-safe native saves.

Missing dedicated support: initiative overrides, contextual/lair XP, habitat/treasure, structured source edition/page/provenance, unknown draft fields, formula HP/AC, multiple sizes/AC choices, structured spellcasting placement/references, and fully structured combined attacks. Literal descriptions can retain complex rules while structured editing is extended.

The scope is material in the newer MM alone:

| Source feature | XMM entries |
|---|---:|
| Habitat | 503 |
| Treasure | 299 |
| Explicit initiative override data | 187 |
| Spellcasting | 132 |
| Spellcasting displayed as an action | 124 |
| Spellcasting displayed as a reaction | 15 |
| Spellcasting displayed as a legendary action | 6 |
| Multiple size choices | 62 |
| Conditional/structured movement | 52 |
| Legendary group dependency | 35 |
| Conditional lair uses | 34 |
| Lair XP | 34 |

Explicit initiative counts are JSON-field counts. Other entries may display derived initiative, as the Aeromancer does. Preserve explicit data where supplied and derive only when the rule is known.

Rule text currently supports emphasis, not 5etools tags or source-aware rule links. Importing raw tagged text would leave markup visible. Introduce safe tag-to-text rendering and structured references; never execute copied source HTML.

### Recommended implementation order

1. **Extend the existing data path for fidelity.** Add optional source/provenance, initiative, contextual XP, habitat/treasure, special HP/AC, multiple sizes, and explicit unknown states. Update draft validation, compiler, reader, native pack mapping, preview, and all exports together. Keep existing version-1 drafts readable.
2. **Add a source adapter and partial import preview.** Prefer the site's structured JSON when available. Resolve inheritance, generated versions, and legendary groups before extraction. Pasted text and later image extraction should feed the same intermediate format. Preserve literal rules, evidence, unconsumed text, and unsupported fields.
3. **Add account-wide name/content review.** Include the standard index, active imports, native creatures, relevant disabled entries, and local drafts. Separate identical reimports, source variants, changed owned drafts, and fuzzy suggestions. Use a comparison hash independent of native UUID/revision metadata; the existing file/content identities are insufficient for cross-format semantic equality.
4. **Add typed reference resolution.** Distinguish resolved, ambiguous, other-edition-only, missing locally, index-only, lookup failed, and search incomplete. Preserve spellcasting placement, uses, DCs, and source overrides. Keep source prose usable when optional links cannot resolve.
5. **Gate publish on reviewed data.** Recheck current account candidates and target revision on save. Reuse existing pack-hash, monster-revision, and atomic updatedAt protections. A same-name match never selects an update target automatically. First support faithful literal rules; richer attack/spell editors can follow.

Unresolved supplemental references can be warnings. Unreadable required statistics or known data loss require correction or an explicitly supported unknown representation. A partial draft can still be retained.

Acceptance cases should cover Aeromancer, Aboleth across editions, scaling spirits, missing CR, generated dependencies, alias/edition ambiguity, disabled or unreadable packs, identical reimport, and changes between preview and save. Verify round-trips through the complete save/read/export path.

## Evidence and limits

- [Machine-readable counts, duplicate groups, feature coverage, and differences](audits/monster-library-2026-10-22.json)
- [All 503 XMM names classified for review](audits/monster-xmm-name-review-2026-10-22.csv)
- [53 selected-statistic review candidates](audits/monster-stat-review-2026-10-22.csv)
- [Earlier import design](MONSTER_STATBLOCK_IMPORT_PLAN.md)

Production reads used the signed-in site's own GET endpoints for active monsters/spells, saved pack summaries, native Workshop library, standard indexes, direct custom spells, and an Aboleth detail sample. Credentials and account identifiers are not included in these artifacts.

Counts are a dated snapshot, not a transactional database snapshot. The public data can change. Full standard-monster availability was sampled with Aboleth, not exhaustively tested for all 334 entries. This audit created only local documentation/evidence files; no runtime test suite was required because application code was unchanged.

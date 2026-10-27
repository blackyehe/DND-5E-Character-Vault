# Compendium source and option grouping preview

One browse listing now holds related source versions and reviewed options across the Compendium. Selecting a version loads and edits that exact original entry. Distinct definitions remain available; grouping does not assert that their rules are equivalent. Existing character propagation still requires explicit per-character review.

Read-only local preview: http://127.0.0.1:5215/compendium. Every category is available through its usual menu. Suggested searches: Genie, Mind Sliver, Artificer, Shifter, Beasthide, Ritual Caster, Bond of the Talisman, Arcane Mastery and Aquan. The captured account has no Other reference entries; that category shows visibly labelled synthetic examples, including two sources of a skill reference and a separate tool reference. Examples exist only in the fixture server, not the application patch or audit totals. Saving is blocked in the preview.

## Baseline and coordination

This supersedes the subclass-only candidate documented in `SUBCLASS_VERSION_GROUPING_PREVIEW_2026-10-23.md`; its subclass behavior is included, not replaced. Source/evidence: `.preview.local/compendium-families-20261023/`.

Reconstructed from committed `8010a11dafbe6f2816798c6def29cf1502a8fc0a` in the combined release checkout. The coordinated live application was `065066d`, deployment `dpl_4SCEZCD3ZDMNA2pyrijGapu9gGLJ`, including notebook Gallery. Neither the dirty root's application source nor the combined checkout's held server diff was changed. No deployment, production database read or production data write was issued by this task.

Coordinated with [Monster Compendium](t3-thread://v1/68af84ca-3df2-42af-8256-2e925251f673). Its prepared-data V3 work stays isolated. Integration must reconcile the held `server/lib/compendium-browse.ts` changes and preserve the latest verified release. Do not apply this older baseline wholesale over later work. In particular, prepared projections must preserve the subclass class parent and the new `familyContext` parent/reference-type fields, apply shared grouping after version-level filters, and invalidate incompatible projection schemas. No integration was performed here.

## Grouping rules

- Preserve specialized monster families/forms and item normalization. Item enhancement levels, base weapons and package quantities remain distinct. Same-label item source versions now receive deterministic numbering in the selector.
- Preserve subclass parent boundaries and all 17 Genie definitions (published patrons, UA options and Noble Genie), with the reviewed subclass spelling aliases from the predecessor.
- Other categories share `shared/compendium-family.ts`. Normalize case, whitespace and apostrophes. Remove only recognized source/edition suffixes; arbitrary parentheses stay significant.
- Spells retain original edition/domain/guild/dunamancy labels in the selector. Reviewed class variants include Artificer revisions, Ranger revisions, sidekick choices and legacy Sorcerer/Wizard class options.
- Race source/form variants retain their original names. Reviewed dragonmark comma/parenthesis spellings group together, while different marks stay separate. The imported Symic Hybrid typo is searchable under Simic Hybrid.
- Subraces group by name plus parent race. Reviewed source-parent aliases are explicit. Missing parents isolate by ID; different ancestry parents remain separate. Reviewed ability/Draconblood/Ravenite choices remain individually selectable.
- Feat/invocation prerequisites remain in search, version labels and rules. A malformed legacy requirement suffix is handled without deleting its content. Reviewed Ritual Caster, Strixhaven, Elemental Touched and Cloud Giant options retain their names.
- Selection level variants keep their levels in version labels. Selections and other references use option/reference type as a grouping boundary. Rune Magic and Runes remain separate.
- Primordial dialect spellings map only to their reviewed dialect name; Primordial itself remains a separate language.
- Search and facets filter individual versions before family grouping and pagination. Original IDs, source objects, editor routing and character review are preserved.

The compact index retains only `familyContext={parent}` for subraces or `{optionType}` for selections/other, plus the predecessor's subclass class parent. It does not add full descriptions/rules to browse responses. Persisted metadata for changed categories uses `compendium-families-1:<revision>`; monster/item storage keys and the global library revision are unchanged in this candidate. The integration owner must reconcile this with V3's separately versioned storage.

## Captured library audit

Verified the recorded SHA256 of all 126 captured packs under `output/compendium-prepared-reader/v2/snapshot`. Added standard index entries and the captured saved Ring of Protection, and applied existing active Workshop lineage rules. Personal-edition captures were empty. Every source ID survives all pages; full and compact grouping counts agree; the source-object digest is unchanged.

| Category | Source entries | Browse families |
| --- | ---: | ---: |
| Spells | 635 | 572 |
| Normal items | 1,402 | 890 |
| Magic items | 5,801 | 4,474 |
| Classes | 48 | 18 |
| Subclasses | 312 | 201 |
| Races | 111 | 59 |
| Subraces | 248 | 194 |
| Monsters | 5,956 | 3,833 |
| Backgrounds | 75 | 75 |
| Feats | 229 | 162 |
| Invocations | 73 | 45 |
| Boons | 4 | 1 |
| Selections | 71 | 52 |
| Languages | 52 | 45 |
| Other reference | 0 | 0 |
| **Total** | **15,017** | **10,621** |

These are the captured account's entries, not every possible library. Backgrounds have no duplicates in this capture; the generic source-version behavior is covered by fixtures. Audit details are in `family-audit.json`.

## Verification and patch

- 28 focused tests across five files pass: generic/subclass identities, parent/type boundaries, requirements, levels, no source mutation, whole-family pagination, item distinctions, compact context persistence and existing index storage.
- Frontend typecheck/production build and server typecheck pass with the baseline's installed dependencies.
- 22 compiled browser checks pass: all 15 categories, selected-version builders, 17 Genie options, unique labels, source filtering, rapid switching, whole-family pages, empty-result recovery, mobile category navigation across all categories, 390/320px layouts and no runtime errors, failed requests or write requests. The read-only fixture never proxies production.
- Shared preview navigation works, but snapshot automation returned `Preview automation snapshot timed out after 15000ms.` Edge/Playwright verified the compiled application; desktop and mobile screenshots were inspected.
- Five application files and four companion test files. Of 448 committed baseline inputs, 443 remain byte-identical; five existing paths changed and four files were added. `manifest.json` and `compendium-families.patch` record all hashes. Patch SHA256: `f4fb33289e1ea0cf7878cb2f9bc062161820b2b81b5b4bbb7141dd27e04debc7`.
- `git apply --check` passes against clean committed baseline files. The known held server diff still needs manual reconciliation; no shared checkout was modified to resolve it.

Run the read-only preview from the root:

```powershell
node server/node_modules/tsx/dist/cli.mjs .preview.local/compendium-families-20261023/serve.ts
```

The preview is staged locally, not promoted. No production data or saved character values changed.

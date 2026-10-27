# Subclass version grouping preview

The subclass browser now uses the monster browser's family/version pattern: one listing within its parent class, then a source/option/version selector. Each selection loads and edits its original source entry. No rules, IDs, saved character selections or source packs are changed.

## Coordination and baseline

Coordinated with the [Monster Compendium thread](t3-thread://v1/68af84ca-3df2-42af-8256-2e925251f673). It confirmed the earlier combined release is live, including notebook Gallery: live app `065066d`, deployment `dpl_4SCEZCD3ZDMNA2pyrijGapu9gGLJ`, source checkpoint `8010a11dafbe6f2816798c6def29cf1502a8fc0a`. Its newer cache experiments and implementation remain separate. No pending prototype was included in this candidate.

The candidate was reconstructed from committed `8010a11`, excluding the combined checkout's held changes and the dirty root. Source: `.preview.local/subclass-families-20261023/source/`. Neither shared checkout was edited.

## Full captured-library review

Read the existing 126-pack capture from `output/compendium-prepared-reader/v2/snapshot`, verifying each pack's recorded SHA256. Applied the existing catalog deduplication and active Workshop lineage rules before grouping. The resulting 300 active imported subclasses plus 12 standard subclasses produce **312 source entries in 201 browse families**. The preliminary raw catalog had 301 imported entries; the pre-existing active-lineage filter removes one superseded Workshop entry.

Every active source ID is preserved, and the complete source-object digest is unchanged after projection and grouping. The full family-to-version inventory and source digest are in `.preview.local/subclass-families-20261023/family-audit.json`. This is the captured account's inventory, not a guarantee about every user's library.

Reviewed relationships:

- **The Genie:** 12 published imports (three definitions for each of Dao, Djinni, Efreeti and Marid), four UA patron entries, and the UA Noble Genie. One Warlock browse family, 17 independently selectable definitions. Labels preserve patron/source, distinguish same-label versions, and place non-UA entries first. Their rules are not asserted equivalent.
- Repeated names within the same parent class, including Tasha's subclasses and UA/book versions, share a family while retaining each source definition.
- Recognized book suffixes such as `(TCoE)` move out of the family name. Arbitrary parentheticals remain significant.
- Explicit reviewed aliases: `Blade Singing` → `Bladesinging`, `Circle of Spres` → `Circle of Spores`, `Circle of the Stars` → `Circle of Stars`.
- Reviewed Path of the Giant Druidcraft/Thaumaturgy options share a family; option names stay in the version selector.
- Known Artificer class-version keys share a parent family, with readable parent-version labels retained. Arbitrary class IDs are not stripped or guessed.
- Standard short labels such as Lore, Draconic and Fiend receive class-specific family labels. Their source names and IDs stay intact.
- Different parent classes stay separate: Fighter Scout and Rogue Scout do not merge. Missing parent metadata cannot prove a family and remains isolated.
- Differently named playtests without an explicit reviewed relationship remain separate; for example, The Undead and The Undying do not merge. Nested ancestry/sidekick parent IDs remain distinct.

Search includes original and family names, parent class, patron and source. Search and filters run on individual versions before families are assembled and paginated; a family never spans pages. Editing and personal editions keep the existing per-character review workflow.

## Implementation and verification

Four application paths: new `shared/subclass-identity.ts`; `shared/compendium-browse.ts`; `server/lib/compendium-browse.ts`; `src/views/CompendiumView.vue`. Three companion test paths. The compact index retains only the parent reference, not subclass descriptions/rules. Only subclass projection storage gets a new schema key; existing caches for all other categories remain usable. No cache prototype activation or background preparation is added.

- 17 focused tests across four files pass: identity/class boundaries, source/option distinctions, sparse standard/raw/Workshop metadata, whole-family pagination, filters/search, unchanged cache behavior and persisted subclass metadata across module reload.
- Frontend typecheck and production build pass. Server typecheck passes using the baseline's installed dependencies. An initial attempt with the root's older dependency set lacked `sharp`; the isolated candidate now points to the combined release's complete server dependencies.
- 14 compiled browser checks pass: all 17 Genie definitions and distinct labels, own source features, selected-version editor, source/patron filtering, class separation, aliases, rapid switching, whole-family pagination, empty-result recovery, 390/320px layouts and zero runtime errors. No write requests were made.
- Shared browser snapshots twice failed with `Preview automation snapshot timed out after 15000ms.` The existing Edge/Playwright fallback verified the compiled app; desktop and mobile screenshots were inspected.
- All 448 baseline tracked inputs were compared: 443 remain byte-identical; five existing application/test paths changed; two files were added. Manifest and focused patch are under `.preview.local/subclass-families-20261023/`. The patch passes `git apply --check` against the clean committed baseline files. It does not apply directly over the combined checkout's held `server/lib/compendium-browse.ts` edits; future integration must reconcile that file with the release owner. Neither shared checkout was modified to resolve this.

## Preview and handoff

Read-only local preview: http://127.0.0.1:5214/compendium. Choose **Classes → Subclasses**, then search **Genie**. On narrow screens, choose Subclasses in Browse category. The preview uses captured data, never proxies production, and rejects every non-GET API request. Edit entry permits inspection; saving is blocked in this local copy.

Run from the root:

```powershell
node server/node_modules/tsx/dist/cli.mjs .preview.local/subclass-families-20261023/serve.ts
```

No hosted deployment or production promotion was issued. Before future integration, preserve the then-current verified release and coordinate with ongoing cache work; its new compact projections must retain subclass parent metadata and use the same shared grouping after filtering. Do not deploy the dirty root or replace a newer live snapshot with this baseline.

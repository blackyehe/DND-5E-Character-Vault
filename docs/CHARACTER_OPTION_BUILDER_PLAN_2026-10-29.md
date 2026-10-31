# Character option builder — implementation plan

Release status: published on 29 October 2026 after exact-source and hosted owner/player checks. See [release evidence and outstanding Git/source limits](audits/creator-option-release-2026-10-29.md). The implementation history below records earlier local-only status.

Status: the supported option-authoring scope is implemented and verified locally on 29 October 2026: feats, backgrounds, invocations, boons, durable nested choice groups, languages, reference entries and parent-aware subraces. See the [completion audit and limits](audits/creator-option-completion-2026-10-29.md), [first-stage audit](audits/character-option-builder-2026-10-29.md) and [invocation/boon audit](audits/invocation-boon-builder-2026-10-29.md). Manual grants require confirmation and acquired levels; arbitrary prerequisites and class allowance progression are not automated. Existing-character ancestry changes retain saved ability scores/speed for manual review. The design below is preserved as historical context. The changes remain unpublished; exact-live comparison and hosted release checks remain outstanding.

## What already exists

`EntryBuilder.vue` and `ReferenceEntryBuilder.vue` already provide guided forms for existing feats, backgrounds, invocations, boons, selections, languages and other reference entries. `OptionBuilder` in `shared/entry-builders.ts` holds the authored fields; `normalizeBuilderEntry()` validates them on the server. The existing Benefits panel supports a bounded set of mechanical grants. These forms currently open through **Edit entry** on an existing Compendium definition.

There is no equivalent standalone option-creation route: the Compendium API edits an existing source, while the main Workshop publish flow accepts class/subclass/race drafts. The main Workshop's “All Compendium entries” tab is an editing surface, not a new-option library. Adding a New feat button alone would therefore leave saving and character availability unfinished.

Creation already selects imported feats and backgrounds. Character editing lists imported feats, but backgrounds/subraces remain text fields. Invocations, boons and generic selections have no complete dedicated selection flow. The room reference projection supplies selected spells, feats, races, subclasses, classes and backgrounds; it does not yet project every proposed option kind. The audit's source-labelled feat/background matching fault must be addressed as part of reliable option identity, without confusing two same-name definitions.

Relevant existing code:

- `shared/entry-builders.ts`, `shared/compendium-editing.ts`, `shared/rule-benefits.ts`
- `src/components/compendium/EntryBuilder.vue`, `ReferenceEntryBuilder.vue`, `RuleBenefitsEditor.vue`
- `server/lib/entry-builder-schema.ts`, `server/lib/workshop-pack.ts`, `server/lib/compendium-character.ts`
- `src/lib/character-builder.ts`, `src/lib/advancements.ts`, `src/components/sheet/CharacterEditTab.vue`
- `server/lib/sheet-references.ts`, `shared/character.ts`, `server/models/Character.ts`

## Supported scope

First deliver **feats and backgrounds end to end**. Both already have creation consumers, so they give a useful result without simultaneously introducing a new invocation allowance/progression system.

Follow with **invocations and boons**, using explicit character selections and level/manual-grant controls. Prerequisite prose remains visible for table review; do not pretend free text can reliably enforce arbitrary rules. Reuse supported Benefits rather than introducing a second calculation engine.

Treat **selections/choice groups** separately: each option needs its own stable identity, an explicit allowed count and stored selected IDs. Name-only text arrays are insufficient for durable references. Resolve nested choices, duplicate selections and changed/removed options before enabling them. Do not automatically grant all offered options.

Languages and miscellaneous reference entries can later reuse the authoring shell, but are not feat substitutes. Classes, subclasses, races, spells, items and monsters keep their dedicated builders. Subrace authoring needs parent-race inheritance review and should not be silently treated as a complete independent race.

## Delivery sequence

1. **Durable selections.** Add additive, versioned references for selected backgrounds/options, including category, stable definition ID and acquired level where appropriate. Update shared types, server persistence/output and matching together. Preserve the existing reviewed-definition mechanism (`compendiumRules`) for approved values and Benefits rather than duplicating it. Plain labels remain display text. Legacy characters use exact IDs/aliases first and only an unambiguous name/source fallback; ambiguous or deleted definitions remain visible with a repair path. Existing characters must not require reimporting.

2. **Complete authoring and persistence for feats/backgrounds.** Reuse the guided option form and server normalizer. Add per-owner local drafts, safe draft recovery and a supported save-to-pack operation. An authored definition needs stable identity/revision semantics before it is normalized into the catalog. Use the existing pack serializer/preservation conventions, duplicate/conflict checks, owner authorization and library invalidation. Creation saves a definition; it does not grant it to every character. Preserve unsupported imported fields when adapting an existing source. Drafts must also be included in backup and supported trash/recovery flows.

3. **Creator/editor integration.** New definitions appear in the existing feat/background catalogs after saving. Preserve feat opportunity limits and explicit table-rule overrides. Add background selection to editing and store IDs when feats are added there. Preview the chosen definition and supported grants before saving; retain copied descriptive text when its source becomes unavailable. Equipment notes do not automatically become granted inventory. Reopening, renaming and two same-name definitions must preserve the chosen identity.

4. **Sheets and rooms.** Hydrate selected owner definitions and send only the selected DM-owned references to assigned players. Add category coverage when invocations/boons/choice groups are enabled. No player needs to import the DM's packs, and assignment must not expose the rest of the library or owner edit routes. Keep room responses outside persistent owner caches. Saved rule changes use the existing review/apply path so the new builder does not overwrite HP, spent resources, inventory or choices. Missing definitions must be reported, not replaced by a guessed same-name rule.

5. **Automatic cache integration and release checks.** Reuse current mutation invalidation and background preparation. New or edited options must become discoverable without clearing browser storage. Verify the new owner reference projection format before reusing persisted sheet references. Include both saved and unsaved device-index paths, session expiry, account switching and fallback behavior. Preserve the foreground pause policy. The current cache work and its release evidence remain separate from this builder work.

Each stage should remain internally usable and validated before the next feature is exposed. Do not publish a New option control until its draft, save, read, edit and selection paths are complete.

## Acceptance checks

- Author a feat and background from an empty library, save to a pack, reload and reopen the same definitions.
- Select each during creation, save the character, reopen editing and retain the same ID, source, description and reviewed grants.
- Rename a definition and create another with the same name; keep the existing character's chosen identity.
- Change a saved definition: browsing updates automatically, while existing character values change only through the intended reviewed path. Applying a grant twice must not double bonuses.
- An assigned player with no packs sees the selected definitions and full copied rules. Unrelated options and owner editing remain unavailable. Removing assignment revokes access from an already-open sheet.
- Deleted packs, failed saves, revision conflicts, unavailable storage and expired sessions keep drafts/characters recoverable. Existing descriptive imports retain unsupported rules and do not gain invented automation.
- Measure authoring-route JavaScript, first choice-catalog load and warm reopening against the exact current live source before recommending publication. No new performance gain is claimed by this planning pass.

## Creation-button pass

The selected layout keeps the existing workbench style: themed paper/field/ink/muted/accent tokens, inherited body font and existing serif headings. In the default obsidian appearance those surfaces are `#141518`, `#0d0e11`, `#f1edef`, `#c1b9be` and the existing crimson accent. No new palette, display type or decorative motion is introduced.

The library's search, content-type buttons and one primary **New class/subclass/race** action now precede the large introduction. Its current type determines the draft kind. While editing, **Back to library**, **Save draft** and **Save to pack…** sit below the Workshop section tabs in the active rules area. Brief help distinguishes device-only drafts from saved pack rules. Item and monster start actions use **New normal item**, **New magic item** and **New monster**; their existing save controls retain their explicit destinations. Account backup stays a secondary header action.

This is a small placement/wording change using existing handlers. It adds no publishing endpoint, schema or automatic character update. The former three header New buttons are replaced by the contextual action, rather than duplicated elsewhere. The broader option-builder design above is not exposed as unfinished UI.

Validation: `npm.cmd run build` passes (frontend type checking and production compilation), and the 22 existing `shared/entry-builders.test.ts` checks pass. No new test suite was added for the reversible label/placement changes. Browser layout and interaction checks have not been performed for this pass. The changes remain local and are not a reviewed release package.

## Deferred audit and release constraints

The [character/Compendium/player audit](audits/character-compendium-player-audit-2026-10-29.md) remains open. Biography/notes persistence and the reproduced long creator name-field anomaly are corrected and verified locally in the completion audit. Special-item validation remains open; none of these local repairs is recorded as published. The earlier feat/background reference gap is covered by explicit identities and focused regressions.

The automatic Compendium preparation is recorded as already published in its [release report](audits/automatic-compendium-cache-2026-10-29.md). [Selective synchronization and opened-detail persistence](audits/selective-compendium-cache-2026-10-29.md) remain a separate retained local change. Preserve both their source/evidence and unrelated extension/editor edits.

The existing Git/live source discrepancy remains a release constraint. Do not bundle the dirty checkout into a deployment or weaken its release guard. This pass makes no commit, push, deployment or production data change.

# Monster creator and reusable actions

## Approved direction

The user approved a guided Workshop with six sections and a final review, plus clickable statblock sections as shortcuts. They approved publishing this implementation and requested that **From action library** sit beneath the Traits & actions heading. The button has its own row below that heading.

The user confirmed that revising a library action must leave existing monster copies unchanged. Adding it again uses the revised definition. Adapt Creature remains a separate, deferred feature recorded as PC-002 in `POTENTIAL_CHANGES.md`.

## Entry point and behaviour

Open **Homebrew Workshop → Monsters & actions → Create monster**.

The creator covers identity and lore; six scores; CR and proficiency with overrides; dice-derived or custom HP; armor/shield calculations; movement; save and skill proficiency/expertise with fixed overrides; damage and condition defenses; senses, passive Perception, languages and telepathy; written rules, attacks, saving-throw effects and spellcasting text; bonus actions, reactions, legendary/mythic/lair/regional rules and their introductions/end notes.

The existing parchment reader supplies the live, independently scrollable preview. Its editing shortcuts are enabled only inside the creator. The Compendium reader remains read-only. One-column viewing is retained; two-column formatting is available for printing.

The action library is account-owned. Actions retain structured attacks/save DCs or safe, bounded text substitutions; inserting an action copies its definition, assigns a new rule ID and records its library revision. There is no live link and no propagation to previous copies. Actions can also be created and revised directly in the action library.

Device drafts save locally. Account saves write a native monster definition into a selected existing Orcbrew pack or a new pack. Saving an already published creature into another pack creates a separate monster copy. Other imported creatures are not adapted or rewritten by this feature.

Export options are Orcbrew, Markdown, PNG and browser printing. Complete account backups include saved packs, reusable actions and browser drafts. The PNG is rendered from the same readable data with a length limit; very long creatures can use Markdown or Print. No external rendering service is used.

## Safeguards and integration

- All new endpoints require authentication and restrict records and pack targets to their owner.
- Backend schemas bound input sizes and validate rules independently of the browser.
- Pack saves compare the expected hash and saved creature revision, then atomically compare `updatedAt` when writing. Unrelated EDN forms retain their original bytes.
- Published/exported packs are parsed again before they are accepted. New creatures use UUID-based keys; names do not determine identity.
- Library edits use an expected revision. They never rewrite monster packs.
- Editors are disabled during writes, and in-progress writes block leaving the creator.
- No character-sheet, HP, equipment, room-assignment or encounter data is migrated or modified.
- Monster Workshop is loaded only when its Workshop section is selected.
- The database model adds the `monster-action` content type. Existing documents require no migration.

## Checks

Frontend and backend type checks and the production build pass. Manual local review used the actual Vue editor with disposable in-memory data, not the public account. It covered creating a rule, saving a reusable attack and saving/read-back of a generated Orcbrew monster through the real schema/pack compiler. The local fixture replaces database persistence; it does not establish an end-to-end production database write result. No automated tests were added or run.

## Publication and rollback

Publication was explicitly authorised by the user. The creator was published on 20 October 2026.

- Application commit: `709538a` — guided monster creator and reusable action library.
- Deployment: `dpl_CZeMBtahKsw61yrRF1iCL2JzJbuF`.
- Deployment URL: https://dndoldal-gagat13q7-dndenjoyerstudio.vercel.app
- Public site: https://dndoldal.vercel.app/homebrew
- Vercel reported READY before promotion, and the public domain was verified against that deployment afterward. `/api/health` returned `{"ok":true}`.
- Signed-in live review confirmed the new Workshop section, guided editor, readable preview, button placement beneath Traits & actions, required-name validation and the existing account's pack choices. No browser warnings or errors were captured during that review. Only an empty device draft was opened; no production packs, reusable actions or characters were changed during verification.
- Screenshot: `.preview.local/monster-creator-live.png` (local review artifact; excluded from deployment).

The preceding production deployment is `dpl_6wuUR7adiwhc9hLmnx4DqV8aRMYc`, the monster-reader release. Restore it with:

```powershell
vercel rollback dpl_6wuUR7adiwhc9hLmnx4DqV8aRMYc --scope dndenjoyerstudio --yes
```

The pre-creator source checkpoint is `5bef522`, tagged `pre-monster-creator-2026-10-20`. Revert implementation commit `709538a`, rebuild and deploy for a source rollback. A Git revert alone does not change Vercel.

Application rollback preserves the database. Saved monsters remain ordinary readable Orcbrew entries; reusable actions remain stored but their editor is unavailable in the older application. Restoring a backup containing the new action content type requires this creator release or a later version. No rollback was executed.

# Character ability placement

The user confirmed that the six ability scores (STR, DEX, INT, WIS, CON, CHA) should move from above the character tabs to immediately above Experience in every character view.

Three display components change: `CharacterHeader.vue` drops the ability row and its unused imports; `CharacterSummary.vue` places the same row between combat statistics and Experience; `CharacterSidebar.vue` moves its existing ability stack before XP in the Classic layout. Calculations, score order, modifiers, responsive styling and XP controls are unchanged. Shared components cover standalone sheets, dashboard sheets, DM room sheets and player previews. Folio ability scores are now within Summary.

Isolated source/evidence: `.preview.local/character-ability-placement-20261024/`. Reconstructed from committed `8010a11dafbe6f2816798c6def29cf1502a8fc0a`; the coordinated release baseline was application `065066d` / deployment `dpl_4SCEZCD3ZDMNA2pyrijGapu9gGLJ`. No current production alias check or promotion was performed. Preserve any newer release during integration. This patch is independent of the Compendium family grouping and prepared-reader candidates.

Frontend typecheck and production build pass. Twelve compiled browser checks pass, covering the four contexts in both layouts, Folio at 390/320px, Classic player preview at 390px, six unchanged scores/modifiers immediately preceding Experience, no duplicate header row, no horizontal page overflow, and no runtime errors or API write requests. Disposable fixtures only; no production data access. Shared browser snapshots twice returned `Preview automation snapshot timed out after 15000ms.` Edge/Playwright fallback verified the compiled app and screenshots were inspected.

The source manifest audits all 448 baseline inputs: 445 unchanged, exactly three changed components, no added application/test files. Patch SHA256: `f1db825f91cbf3e25ffe7d264124132007c4af9775ae62fd9648a806527f3710`. `git apply --check` passes against clean baseline files. Neither shared checkout was modified. The Monster Compendium thread was notified to preserve this separate change in eventual integration.

Read-only local preview: http://127.0.0.1:5216/characters/000000000000000000000001 — choose Summary. Dashboard example: http://127.0.0.1:5216/?character=000000000000000000000001. API mutations are rejected in the fixture server. The preview uses disposable sample characters.

Run from the repository root:

```powershell
node server/node_modules/tsx/dist/cli.mjs .preview.local/character-ability-placement-20261024/serve.ts
```

Published after user approval on 2026-10-24. See `CHARACTER_ABILITY_PLACEMENT_RELEASE_2026-10-24.md` for the current production baseline, exact source audit and live checks. The preview/evidence above remains the original reviewed local candidate.

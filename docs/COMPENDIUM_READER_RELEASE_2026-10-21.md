# Summary alignment and readable Compendium rules

## Changes and reasons

- Summary's statistics and skills panels still inherited a 1024px cap from the older compact layout, while the Training & languages / Experience grid could grow wider. The Summary panels now use their parent grid's full width and matching edges. This applies to sheets in the dashboard, rooms and standalone view.
- The Compendium previously understood descriptions only for a few categories. Most other entries fell back to an automatically expanded JSON dump. A presentation-only reader now formats descriptions, facts, proficiencies, prerequisites, equipment choices, traits, level features, spellcasting and unusual imported rule fields.
- Standard SRD entries are now included alongside imported content in Subraces, Backgrounds, Feats, Subclasses and Languages. Existing Classes and Races have dedicated readable facts and rule sections.
- SRD class/subclass levels load separately from the base entry. Linked feature/trait descriptions load on expansion through the existing cached SRD client, with loading and retry controls. Opening a class does not fetch every linked feature immediately.
- Invocations, boons and selection options display their prose and named choices. Genuine name-only imports explain that their source has no description. File/editor identifiers and API paths are excluded from the reading view. No missing rules are inferred or written back into saved content.
- Spell details also show material components, concentration and higher-level descriptions where supplied. Item and monster readers remain in place. Detail scrolling remains independent and resets when choosing another entry.

Implementation commit: `32fafba` on `codex/folio-sheet-rollout`.

## Published release

- Public site: https://dndoldal.vercel.app
- Deployment: `dpl_Ay7zUC5F2G7QSc6fU56dZJ9gTnjU`.
- Deployment URL: https://dndoldal-mbuk125qo-dndenjoyerstudio.vercel.app
- Public-domain inspection confirmed this Ready deployment; `/api/health` returned `{"ok":true}`.
- Signed-in live review confirmed Wizard's readable sections and expanded Arcane Recovery prose. Live Summary panels shared the same edges: 731px expanded; 891px after collapsing the roster and switching to Lortar. No production character, resource or library data was edited.
- The live Compendium's captured warning/error log was empty. Screenshots are saved locally as `.preview.local/compendium-readable-live.png` and `.preview.local/summary-alignment-live.png`, excluded from Git and deployment.

## Review

- Frontend type checking and production build passed (228 modules). No automated tests were added or run.
- The real app was reviewed with a disposable local API using the supplied `all-content.orcbrew` file and actual public SRD responses. No production character or library data was changed.
- Summary statistics, skills and secondary grid measured the same left edge and width before/after character switching: 891px with the roster collapsed, and 731px expanded at the checked desktop viewport. Computed panel maximum width is `none`.
- Reviewed SRD Wizard, including expanded Arcane Recovery text; imported Divine Soul Sorcerer; Elf with expanded Fey Ancestry; High Elf; Acolyte and its choices; Grappler; imported Lucky; Evocation's feature levels; imported Phantom; Common; name-only Troglodyte; Improved Pact Weapon; Pact of the Talisman; and College of Swords Fighting Style selections.
- Also reviewed Fireball's scaling/material text, Longsword statistics, Ring of Protection description and Adult Black Dragon statblock. Other reference had no entries in the supplied catalog; its empty state was reviewed. Homebrew file management was not changed.
- The imported class reader contained no raw-code blocks; detail overflow remained `auto`. The browser's captured warning/error log was empty at the checked navigation.
- This is a representative content review, not a guarantee that every third-party file supplies complete or correct rules. Missing source descriptions cannot be reconstructed by formatting.

## Rollback

- Source checkpoint: `pre-compendium-reader-2026-10-21`, pointing to `e3098c4`.
- Revert `32fafba`, rebuild and deploy for a source rollback.
- Exact preceding live deployment: `dpl_37LpMZJUDmwkMowMQy1mSgLVS1Ny`.
- Previous deployment URL: https://dndoldal-ev9vfvoy5-dndenjoyerstudio.vercel.app

```powershell
vercel rollback dpl_37LpMZJUDmwkMowMQy1mSgLVS1Ny --scope dndenjoyerstudio --yes
```

This restores the application version without rolling back database data. Rollback was retained and documented, not executed.

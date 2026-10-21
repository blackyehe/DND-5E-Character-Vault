# All character tabs: panel edges and numeric alignment

Implementation commit: `507f828` on `codex/folio-sheet-rollout`.

## Published release

- Public site: https://dndoldal.vercel.app
- Deployment: `dpl_AJRy8WDEPDpinXCoPyce9djzVkz1`.
- Deployment URL: https://dndoldal-9j9qnjde3-dndenjoyerstudio.vercel.app
- Public-domain inspection confirmed this Ready release; `/api/health` returned `{"ok":true}`.
- Signed-in live review covered Summary and every other reading tab on Lortar. Full-width panels filled their content area; Proficiencies/Bio grids retained equal columns. No horizontal page overflow was measured. Summary's centred groups measured zero horizontal/vertical centre offset with the roster both expanded and collapsed.
- The captured live browser warning/error log was empty. The original collapsed-roster state was restored. No production character/resource data was changed.
- Screenshot: `.preview.local/all-sheet-tabs-aligned-live.png`, excluded from Git and deployment.

## Changes and reasons

The earlier Summary correction addressed that tab alone. Other reading panels still inherited different maximum widths (1024px for general panels and 920px for inventory groups), while grids and feature sections filled the available space. These old caps are now removed from reading panels. The outer workspace bounds remain; nested two-column panels fill their own grid columns. The Classic Summary also follows its available column. Editor forms keep their separate 880px maximum, with matching heading, navigation and save bar.

The sheet content is now a named size container. Proficiency, Bio, Summary and spell grids adapt to the actual content width after the roster and resource rail take their space. Narrow inventory controls can wrap, and narrow forms use one column. This avoids relying only on browser width when a desktop sheet has little usable space beside its roster.

The shared Summary/Combat stat strip uses equal grid cells with each label/value pair centred horizontally and vertically. Narrow strips wrap into balanced rows. Ability-score headers, skill/save bonuses, casting statistics, resource fractions, HP controls and numeric inputs use consistent numeric alignment and tabular digits where the font supports them. Prose values such as names/backgrounds are not centred as numeric cells.

These are presentation changes. Character values, spell rules, save paths, player permissions, loading caches and refresh intervals are unchanged.

## Local review

- Frontend type checking and production build passed (229 modules). No automated test suite was added or run.
- Actual app reviewed using disposable local characters containing spells, weapons, armour, treasure, gear, resources and features. No live character data was used for local saves.
- Reviewed Summary, Combat, Spells, Equipment, Features, Proficiencies and Bio with the dashboard roster expanded and collapsed. Full-width panels matched their content area; intentional grid columns matched one another. No page overflow was measured.
- Reviewed all assigned-player reading tabs, including Shadow Champions. Reviewed the Classic player's Combat, Spells, Equipment, Features, Proficiencies and Bio; these remained aligned even with a 355px content area. Restored the original local Folio preference afterwards.
- At the normal desktop viewport, Summary label/value pairs measured zero horizontal/vertical centre offset. The visible 880px editor heading, navigation, content and save bar shared their left edge.
- For actual responsive checks, the real app was displayed in same-origin 390px and 1440px iframe viewports. At the narrow size, every reading tab used 347px panels and its multi-column sections stacked without page overflow. At the wide size, Summary, Equipment and other rail-layout content used 1051px, exceeding the former caps; Combat used 1299px. Intentional half-width grids retained matching columns. All reading tabs were checked at both sizes.
- This is a browser layout review, not a physical phone/touch-device check. The browser viewport override did not apply, so the constrained app frames were used instead; the temporary override request was reset.
- Captured browser warning/error logs were empty for the completed checks.

## Rollback

- Source checkpoint: `pre-all-sheet-tabs-alignment-2026-10-21`, pointing to `7b7c612`.
- Revert `507f828`, rebuild and deploy for a source rollback.
- Previous live deployment: `dpl_Ay7zUC5F2G7QSc6fU56dZJ9gTnjU`.
- Previous URL: https://dndoldal-mbuk125qo-dndenjoyerstudio.vercel.app

```powershell
vercel rollback dpl_Ay7zUC5F2G7QSc6fU56dZJ9gTnjU --scope dndenjoyerstudio --yes
```

Application rollback retains current database characters and play state. Rollback was documented, not executed.

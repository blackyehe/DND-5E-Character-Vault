# Focused DM party dashboard

The user selected direction 2, One character, with the existing live vitals and HP editing retained. This replaces the room's DM Party dashboard. The personal character library is unchanged.

The left roster retains each included character's current/max HP, temporary HP and AC. The selected character displays full vitals, inspiration, saving throws, all trained skills, expertise and armour/weapon/tool/language training. Combat references, spells and resource controls use optional disclosures. Phones use a labelled native character selector. Sheet links retain the existing adjacent full sheet, collapsible chooser and Back to party navigation.

Damage, healing, temporary HP, inspiration and resource/slot actions retain the existing server timestamp checks. Damage absorbs temporary HP first. Conflicts reload current values and require the DM to review before repeating an action. Existing assigned-character defaults, explicit party inclusion and role boundaries remain intact.

## Three implementation and review passes

1. Replaced competing expanded rows with one selected character workspace. Retained aggregate vitals, per-character HP inputs and safe play actions. Saving throws and training appear before optional combat content. Selected details use local component data, independently of the current-sheet store.
2. Reviewed actual local character data on desktop, tablet and phone. Tightened desktop action alignment and spacing, removed repeated noncaster speed, retained caster speed, corrected the mobile selector's accessible name, and retained exact focus/scroll/search/disclosure state through sheet navigation.
3. Verified real saves, conflict recovery, resource and slot changes, expertise, active-item save bonuses, slow character switches, polling, role visibility, large text and long content. Switching characters clears the old reference while the new one loads. Unchanged polls retain open disclosures and do not fetch selected details again. No new entrance animations or nested scroll areas were introduced.

## Validation

- Frontend TypeScript check and production build passed, including a build of the isolated current-live source with the three reviewed files overlaid.
- 42 focused tests passed across the party snapshot/play-update/room-access dependency suite.
- Local browser checks passed for damage, healing, Enter-to-set temporary HP, genuine HTTP 409 recovery without replay, save locks, resource spending/recovery, caster slots/DC, ordered saves, expertise, keyboard navigation and sheet return.
- Responsive browser checks passed at 1440, 1024, 834, 728, 390 and 320 pixels. Additional checks used larger text, long identities/training, all 18 skills and active/inactive item save bonuses. DM controls were absent from player preview.
- Synthetic local character state was restored after save tests. Long-content/item fixtures were browser-response overrides only. No production character writes were made for QA.

Native T3 preview status/open worked, but snapshot automation timed out. Browser QA used an isolated Edge/Playwright context after that failure. Authenticated save interactions were verified locally; production verification is read-only.

## Release isolation

Release evidence: `.preview.local/party-focus-release-20261022/`.

Reconstructed all 303 source files of the current production deployment `dpl_5nZau4Uog7Vmmdrk26YBcB41G3Hn` by matching their source hashes. The release changes only:

- `src/components/party/PartyDashboard.vue`
- `src/components/party/PartyCombatKit.vue`
- `src/components/party/party-dashboard.css`

All 303 dry-run upload hashes match the reviewed source manifest. Current notebook, maps, character folders, level-up and other live code are preserved. The working checkout's unrelated edits were not published.

Published release: `dpl_3ahivW3KCmEZ4JWX6zTjjAR7WYVv`, https://dndoldal-hbp60wtos-dndenjoyerstudio.vercel.app, promoted to https://dndoldal.vercel.app. Verified the public alias was still on the reviewed baseline immediately before promotion. The ready deployment's 303 uploaded source hashes exactly matched the reviewed manifest.

Staged and public health returned 200. The public room JavaScript/CSS contain the new focused dashboard, saving throws and HP controls. Unauthenticated party access returned 401. Desktop/mobile browser checks confirmed the protected-room redirect and usable login form without runtime errors. The main checkout's three party UI files match the published source.

Rollback target: `dpl_5nZau4Uog7Vmmdrk26YBcB41G3Hn`. No database schema change or migration is involved.

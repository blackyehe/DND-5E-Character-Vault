# Monster statblock reader

## Scope — 20 October 2026

The Compendium's Monsters category now has a dedicated statblock reader. The user requested the reader before the monster builder, with all descriptions visible and the containing panel scrollable. The builder remains deferred.

The visual reference is [Tetra-cube's statblock generator](https://tetra-cube.com/dnd/dnd-statblock.html): narrow parchment, small-cap serif name, dark red labels and tapered dividers, six ability columns, and fully expanded rules. The surrounding Compendium keeps the user's site theme. Markup, CSS and texture are implemented locally; no generator source or parchment image was copied.

## What is displayed

- Identity, armor class and armor notes, hit points and full hit dice, speed, ability scores and modifiers.
- Recorded saving throws, skills, defenses, senses, languages, challenge, XP and proficiency bonus.
- Traits, actions, bonus actions, reactions, legendary actions, mythic actions, lair actions and regional effects when present in the entry.
- Usage labels supplied as structured data, such as daily uses and recharge rolls.
- Source and an optional disclosure for the original reference data, outside the statblock. Rules themselves are never collapsed.

The existing right-hand Compendium panel retains its 70vh maximum height, keyboard focus and independent vertical scrolling. Selecting a new entry retains the existing scroll reset. On very narrow panels the ability scores wrap to three columns.

## Data handling

`shared/monster-statblock.ts` converts full SRD responses and normalized Orcbrew entries into one read-only presentation model. Imported entries are read from their preserved original fields because older normalization filled absent statistics with zeroes. Missing core fields are labelled rather than invented. HP can be calculated from explicitly recorded hit dice and modifier; save bonuses, XP and proficiency bonus are not guessed.

An imported feature's explicit type or a name prefix such as `Reaction:` determines its section. Untyped rules remain traits. Feature text, including unusual imported numbers, is preserved. Simple emphasis is rendered through Vue text nodes; imported HTML is not executed.

The original structured feature record is retained in `mechanics` for later work. This is **not** an automation engine: prose is not converted into targeting, damage or saving-throw instructions. Supporting future encounter calculations will need a separately confirmed rules model.

The reader requires no database migration and writes no changes to characters or imported packs. Other Compendium categories retain their current readers.

## Fonts and loading

The statblock uses bundled Libre Baskerville and Noto Sans Latin WOFF2 fonts (about 96 KB combined). Their SIL Open Font License files are in `src/assets/fonts/statblock/`. Fonts are loaded with `font-display: swap`; no external font service is needed at runtime. The Compendium remains a lazy-loaded route.

## Review and build

- Frontend type checking completed successfully.
- Production frontend build completed successfully.
- Actual component markup was reviewed locally with an SRD Goblin, an Adult Red Dragon and an imported Hobgoblin Warlord. These cover short rules, long action lists, recharge labels, legendary actions and an imported reaction.
- A long imported entry was scrolled to its reaction and source without expanding individual rules.
- No automated tests were added or run. Post-publication checks are recorded below.

Local example fixtures and review helpers live under the ignored `.preview.local/` directory and are excluded from deployments.

## Release and rollback

The user approved publication on 20 October 2026: “this can go live yeah.” Application commit `7ef28e1` was built and promoted successfully.

- Public site: https://dndoldal.vercel.app/compendium — select **Monsters**.
- Published deployment: `dpl_6wuUR7adiwhc9hLmnx4DqV8aRMYc`.
- Deployment URL: https://dndoldal-3um9qf9x4-dndenjoyerstudio.vercel.app
- Inspection confirmed the public domain resolves to this Ready deployment.
- Home page returned HTTP 200; backend health reported `ok: true`.
- The signed-in live Compendium rendered the Adult Red Dragon's complete stats, traits, actions and legendary actions.
- Its detail panel measured 502px high with 1092px of content, `overflow-y: auto`, and no horizontal overflow. Scrolling reached 590px, the bottom of the panel, with the final legendary action readable. Captured browser error logs were empty for this check.
- No production content edits, permission changes or database migrations were performed.

### Immediate deployment rollback

The exact preceding live deployment remains available: `dpl_7UGM4XjRtayHBiqjGjsYfdeofNBD` (application commit `529f0ba`).

```powershell
vercel rollback dpl_7UGM4XjRtayHBiqjGjsYfdeofNBD --scope dndenjoyerstudio --yes
```

This restores the previous application while preserving the current database and play state. Rollback is documented, not executed.

### Source rollback

Before this change, the Git checkpoint was `88c3483` on `codex/folio-sheet-rollout`. Revert `7ef28e1` in GitHub Desktop to remove the reader, then rebuild and deploy. A Git revert alone does not update Vercel; the deployment rollback is the quickest return to the exact previous live application. No database rollback is required.

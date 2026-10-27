# Compendium selectable benefits preview — 2026-10-23

Status: revised isolated preview; production promotion requires the user's review.

Ready deployment: `dpl_xpZhG9RWNetTFadQEu3t4qCLtEEQ` at `https://dndoldal-li5uvti3a-dndenjoyerstudio.vercel.app`. All 329 uploaded source hashes match the isolated candidate. The public main domain remains on `dpl_8McziMm9wyZhpA7PV3XdA5mwFyCm`. A seven-day deployment-scoped share link is recorded privately in `preview-link.local.json`.

## Release source

- Candidate: `.preview.local/compendium-benefits-20261023/source`.
- Live baseline: `dpl_8McziMm9wyZhpA7PV3XdA5mwFyCm`, preserving Party/feat/reference rollout `dpl_7tHoxpxAXpXgmjr4eqcntDzEXkNV` plus notebook syntax feedback and the subsequent map-pin/error update.
- Audit: 318 baseline inputs, 292 unchanged, 26 focused replacements, 11 additions, 329 candidate inputs. All dry-run hashes matched.
- Root checkout contains unrelated concurrent work. Never deploy root. Focused benefit edits were synced with normalized comparison to the previous Compendium candidate; unrelated root changes retained. See `root-sync.json` and `root-before/`.
- The one-time resume task is disabled.

## User behavior

Compendium and Homebrew Workshop open the same personal entry editor for all 15 categories. Benefits have a meaningful type, dependent value selector or numeric input, and unlock level. Spell grants have spell, casting ability and spell-level choices. Raw imported keyword rows are converted to controls without discarding unknown source fields. An explicit empty benefits list removes imported benefits; Restore source restores the source definition.

The editor follows Dungeon Master's Vault's dependent type/value/level pattern, researched in the upstream Orcpub custom editor. Existing site styling is retained.

Thirty shared benefit types cover damage resistance/immunity/vulnerability, condition immunity and save advantage, skill/save/armor/weapon/tool training, languages, extra attacks, movement and senses, AC/save/initiative/weapon/spell bonuses, and granted spells. Creature entries offer the applicable stat-block subset.

The shared evaluator uses approved character snapshots and existing Workshop bindings. Class/subclass benefits use the relevant class level. Other character grants use character level. Equipment must be present, equipped and attuned when required. Spell effects require an explicit Combat toggle and an available, reviewed spell. Derived effects do not rewrite or accumulate into saved base values. Damage type controls in the sheet and Party apply defenses before temporary HP; already-adjusted/untyped damage remains available.

Saving a personal edition does not propagate it automatically. Find affected characters shows current/proposed changes, including effective benefits and sources. Each character needs explicit Apply; ambiguous source matches require source confirmation. Compare-and-set guards reject stale definition or character reviews. Source restoration also requires a new character review.

## Practical limits

- Unknown imported types are retained and do not execute. Creature types outside its supported subset are described as requiring manual adjudication.
- Condition tracking, advantage rolls, spell duration/concentration, spell costs and limited uses remain manual. The UI states these limits.
- Arbitrary prose, prerequisites, ability-score grants, ambiguous removals and player choices are not inferred.
- Existing bonuses manually included in saved base stats may need manual adjustment after reviewing a new derived bonus.
- This does not rebuild character creation. Newly created characters use the existing creation and review flow.
- Preview uses the production account database. Save and Apply are real writes by the user, even though the main domain remains on the baseline. Agent testing used in-memory fixtures; no production data writes.

## Evidence

- 131 tests across 11 files passed, including engine semantics, all categories, save/review authorization, stale reviews, malformed enum rejection, restoration, class level gates, item activation, Party damage and creature calculations.
- Frontend typecheck/build and server typecheck passed.
- 12 compiled browser workflow checks passed: all categories, save/restore, review confirmation, conflict/draft preservation, keyboard focus, touch, retry, rapid Escape/reopen and narrow layouts.
- 11 compiled benefit browser checks passed: imported selections, canonical save, unknown fields, type switching, spell grants, removing all benefits, derived AC/defenses, typed damage with temporary HP, reversible spell effects, expertise, phone overflow and runtime errors.
- Screenshots inspected: desktop and phone editor, narrow character sheet.
- Browser automation fallback: T3 snapshot twice returned `Preview automation snapshot timed out after 15000ms.` Existing fixture-only Playwright/Edge harnesses were used.
- Release metadata and public read-only checks are recorded in `staged.json`, `published-files.json`, `preview-results.json` and `preview-link.local.json` in the candidate directory.

No main-domain promotion is authorized until the user has reviewed this revised preview. Recheck the live baseline before any later promotion; preserve any newer release.

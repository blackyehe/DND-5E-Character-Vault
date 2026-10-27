# Compendium editing — implementation and verification

Implemented and verified on 23 October 2026. A separate review deployment is ready; the public site has not been promoted.

## Behaviour

- Edit entry covers all 15 rule categories. Homebrew Workshop → All Compendium entries opens the same editor.
- Text, numbers, flags, lists, rules and additional source fields have structured controls. Large nested sections render when opened. Native definitions use the existing Workshop schema and reconciliation engine.
- Personal editions retain original reference identity and provenance. Source comparison is read-only; source restoration clears the personal changes while retaining a revision tombstone. Original packs and the public SRD remain intact.
- Unsaved drafts are protected on Escape, closing, navigation and page exit. Conflicting saves retain the draft and offer a download before loading the saved version.
- Saving changes the account's Compendium. Find affected characters prepares a read-only current/proposed comparison for each owned character. Source confirmation and Apply are required per character.
- Each character retains its approved edition until another review. A later entry edit or source restoration also needs approval. Newly created characters can be updated through this review workflow; character creation continues its normal source selection.
- Class/subclass/race reconciliation preserves current HP, spent resources, selected choices and custom values. Item changes preserve quantity, equipment identity, equipped state, attunement and personal notes. Reviewed spells reach both the opening response and protected sheet references, including room views.
- The reference cache observes character approvals independently of pack revisions. Unused approved definitions are excluded from protected room reference responses.

## Deliberate limits

Prose is not parsed into executable mechanics. Generic feats, backgrounds, subraces, invocations, boons, selections and other reference entries update matching unmodified feature text after approval. Ability-score grants, prerequisites, removed generic features and player choices require manual review. Custom text and item values that differ from their source are retained. The interface explains these cases.

Native classes, subclasses and races retain the Workshop engine's existing review safeguards for custom maximum HP, multiclass slots and ambiguous choices. Source confirmation is necessary because older sheets may record only names or legacy spell keys.

Source restoration needs an available original. Approved snapshots remain usable if their pack disappears. Entry saves have a 2 MB limit; unusually large definitions may need editing in their source file.

## Data and endpoints

`CustomContent.type = compendium-edit` stores category, immutable index, revision, original source hash and changed fields, unique per account/category/index. `Character.compendiumRules` stores definitions explicitly approved for that sheet.

- `GET /api/compendium/:kind`: account editions.
- `GET /api/compendium/:kind/:index`: current source, effective edition and revision.
- `PUT /api/compendium/:kind/:index`: validated save or restoration, requiring expected entry revision and source hash.
- `GET /api/compendium/:kind/:index/review`: read-only owned-character proposals.
- `POST /api/compendium/:kind/:index/review/:characterId`: verifies entry revision, proposal hash, character timestamp and source confirmation, then uses a compare-and-set update.

Authentication and account filters apply throughout. Identity changes, reserved keys, excessive nesting, invalid field types and invalid native/item rules are rejected. No automatic character update occurs when saving an edition.

## Candidate and validation

Live baseline: `dpl_7tHoxpxAXpXgmjr4eqcntDzEXkNV` at https://dndoldal.vercel.app.

Isolated source/evidence: `.preview.local/compendium-editing-20261023/`.

All 315 live inputs were reconstructed by hash. The candidate preserves 304 inputs byte-for-byte, changes 11 focused inputs and adds seven (322 total). Navigation, Grim Harvest, reader, Party, Maps and notebook changes remain present. The candidate's `server/app.ts` was patched from production independently of the dirty root copy. Do not deploy the dirty root checkout.

`production-manifest.json`, `expected-files.json`, `changes.json`, `audit.json` and `paths.json` record the source delta. `audit.mjs` checks the live alias and fails if production advanced; rebase and reverify before any eventual promotion.

Validation passed:

- Isolated frontend typecheck and production build.
- Isolated server typecheck.
- 63 tests across seven files: authenticated saves/restores for all categories, identity/source preservation, conflicts, account boundaries, source resolution, character review/apply, native reconciliation, item presentation sync, open-sheet cache invalidation, and navigation/Grim Harvest/reader/feat regressions.
- 12 compiled browser workflow checks: all editors on mobile, source restoration, draft/conflict recovery, per-character comparison and approval, Workshop access, desktop/narrow-phone layout, focus containment, touch controls, rapid Escape/reopen and no uncaught errors.

API tests use in-memory models; browser writes use intercepted local fixtures. Agent production data writes: zero. The review deployment is ready without promotion to the public site.

Review deployment: `dpl_A29sFNwHfcT98jBGeGM3LSbiSaKL`, https://dndoldal-aylpwc5rv-dndenjoyerstudio.vercel.app. All 322 uploaded source hashes match the reviewed inputs. Health returned 200; unauthenticated entry list, entry detail and character review requests returned 401. Desktop and mobile login checks passed without uncaught errors. The public alias still points to `dpl_7tHoxpxAXpXgmjr4eqcntDzEXkNV`. Evidence: `staged.json`, `published-files.json` and `preview-results.json` in the isolated evidence directory. A deployment-scoped share link is available for seven days; it does not bypass application login. This preview uses production account data: user saves and character approvals persist. Wait for the user's preview review before promotion.

Run checks from the workspace:

```text
npx.cmd vitest run --config .preview.local/compendium-editing-20261023/vitest.config.ts
node .preview.local/compendium-editing-20261023/browser.mjs
node .preview.local/compendium-editing-20261023/audit.mjs
```

Run `npm.cmd run build` and `npm.cmd run server:typecheck` inside the isolated `source` directory. Browser checks expect that compiled source on port 5198, served using the adjacent `preview.config.ts`. Evidence includes `browser-results.json`, `editor-desktop.png`, `editor-mobile.png`, `review-mobile.png` and `validation.json`.

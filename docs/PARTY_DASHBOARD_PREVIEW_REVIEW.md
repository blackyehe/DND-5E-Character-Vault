# Party dashboard - three local design previews

Status: refined design and corrected full-sheet workspace accepted, then separately authorised for publication on 22 October 2026. It is now live at https://dndoldal.vercel.app. See [the release record](PARTY_DASHBOARD_RELEASE_2026-10-22.md). The comparison and local verification below describe the preview phase. No Git commit, PR, Git push, or production-data write was performed.

## Working local links

All three links use the existing local demo account from the conversation. Open **Character details** on a member to inspect the design.

1. [Broad reference](http://127.0.0.1:5174/rooms/6ad9c771eac2ff6eb172acbe): saves/training on the left, resources and combat on the right. Readable at a desktop, but phones put attacks about 1,550 pixels below the panel start.
2. [Combat first](http://127.0.0.1:5175/rooms/6ad9c771eac2ff6eb172acbe): attacks and feature excerpts first, ability/save tiles alongside. Phone attacks move to about 350 pixels, but saves move below roughly 1,390 pixels.
3. [Refined reference](http://127.0.0.1:5173/rooms/6ad9c771eac2ff6eb172acbe): recommended preview. A common six-save strip stays above the rest, then attacks/skills and features/proficiencies share aligned rows. Resources use the full panel width. On the same 390-pixel Fighter example, saves begin about 250 pixels and attacks about 632 pixels from the panel start. All sections remain present rather than hidden behind category tabs.

These figures describe the representative synthetic Fighter, not every character's content height. Each version was actually built and inspected with desktop/tablet/phone screenshots, including a caster. The final version also received narrow-phone, large-text, theme, keyboard, and live-save verification.

## Refinements selected from the comparison

- Keep all six saves visible together, with ability score/modifier as secondary information. Mark proficiency in text for screen readers as well as with a visible dot.
- Show useful feature excerpts before opening their full rules. Preserve pinned-first ordering and an option to include noncombat features.
- Keep attacks and skills near the top; group proficiencies alongside combat features rather than adding four large empty training blocks.
- Show up to eight trained skills initially for unusually broad training; the explicitly labelled All skills control exposes all 18 modifiers. No nested scroll region is introduced.
- Put live trackers after the core reference and use two columns where room permits. Trackers remain initially open, with optional collapse.
- Show saved spell casting time/range on the spell row; search available spell rule text as well as names.
- Disable sheet links visibly during saves. Keep direct access to Proficiencies as well as the other sheet sections.
- Restore scroll, filters, open rules, and exact focus after returning from a sheet. Keep expansion/collapse triggers in view, including collapse from the panel bottom.
- Respect the existing theme, reading size, typography, and reduced-motion settings. Correct disclosure markers that wrapped away from their headings in classic typography.

## Verification of the final preview

Passed:

- `npm run build`, including frontend typecheck.
- `npm run server:typecheck`.
- All 14 tests in `shared/party-dashboard.test.ts` and `server/routes/rooms-party.test.ts`.
- Browser login through the actual login form and explicit party selection, including a persisted empty selection and restoration of assigned defaults.
- Saving throws, proficiency markings, ability modifiers, expertise, equipped/custom attacks, and an active-item save bonus. Direct navigation to the real sheet's Proficiencies section was checked against the preview values.
- Actual damage with temporary HP absorbed first, Enter-to-set temporary HP, resource spending/recovery, and spell-slot use/restoration.
- A genuine simultaneous server write returning HTTP 409 to the dashboard. Latest values reloaded and the original action was not replayed.
- Saving-state disabled controls, sheet-section navigation, and restoration of filter, rule expansion, scroll position, and exact focus.
- A visible polling interval with no additional quick-sheet read for unchanged data and no reset of expanded rule state.
- Keyboard dropdown opening, rule expansion, and bottom collapse with visible focus restoration.
- Screenshots and overflow checks at 1440, 834, 390, and 320 CSS pixels. A separate synthetic stress character has a long name, 18 trained skills, long proficiencies, an active magic item, and 11 custom resources in addition to class resources.
- Sixteen large-text theme/width combinations: obsidian/folio, parchment/classic, light/folio, and dark/folio. No horizontal overflow or offscreen panel content. OS and app reduced motion produced no running animations. Phone controls and checkbox labels provide 44-pixel touch targets.
- No uncaught browser page errors.

The product-native T3 preview was tried first. Snapshot failed twice with `Preview automation snapshot timed out after 15000ms.` Following the browser fallback rule, the checks above used an independent local headless Edge context via Playwright. This did not reuse or change the user's live browser session.

The earlier full-suite Dagger expectation failure is recorded in `PARTY_DASHBOARD.md`. The full suite was not repeated for this frontend refinement; the focused suite and relevant builds were run on the final source.

## Local artifacts and restarting previews

Alternative component/CSS snapshots and review screenshots/scripts/results live in ignored `.preview.local/party-review/`. They are review tools, not a permanent app design selector. The tracked application uses the refined design; the two alternative servers substitute archived local components and styles through a Vite preview-only plugin.

- Refined: `npm run dev -- --config .preview.local/party-link.config.ts` (port 5173).
- Broad: set PowerShell `$env:PARTY_REVIEW_VARIANT='a'`, then `npm run dev -- --config .preview.local/party-review/variant.config.ts` (port 5174).
- Combat first: set `$env:PARTY_REVIEW_VARIANT='b'`, then the same variant command (port 5175).
- API: set `$env:PORT='4012'` and `$env:MONGO_URI='mongodb://127.0.0.1:27017/dnd_site'`, then `npm --prefix server run start`.

All previews are currently left running locally. They may need restarting after the machine or sessions stop. All API proxies preserve Host with `changeOrigin: false`; retain this so login requests pass the API origin check.

Synthetic review records were created separately from the earlier demo room. Save tests restored the synthetic characters they changed. Credentials and session tokens are not stored in tracked documentation. The review scripts are local verification artifacts, not part of the production test suite.

## Remaining scope and next decision

The user selected the refined preview, approved the corrected full-sheet layout, and subsequently authorised its publication. [The release record](PARTY_DASHBOARD_RELEASE_2026-10-22.md) covers the completed rollout. Custom/full spell references and innate spells still use the main sheet; the dashboard is a saved-data reference with 15-second polling, not a real-time combat engine. No encounter, initiative tracker, condition/concentration state, dice system, or Owlbear integration was added.

## Accepted refined dashboard: full-sheet layout correction

The refined dashboard remains the selected preview. The user requested the existing collapsible character chooser on the left with the full sheet filling the space beside it.

The return-to-party bar was a third direct child of the two-column workspace without a column span. This placed the roster in the wide column and wrapped the sheet into the 216-pixel left column. The bar now spans both columns; the roster and sheet share the following row. Collapsing the roster frees another 160 pixels for the sheet. The empty roster state also spans the full sheet width, and the sticky roster starts below the return bar.

Focused local Edge checks verified expanded/collapsed geometry at 1440, 1024, 834, 760, 390, and 320 CSS pixels; roster character switching; Combat, Spells, Equipment, Features, Proficiencies, and Summary at desktop/tablet/phone widths; keyboard collapse/expand with retained focus; sticky return-bar clearance; and returning to the party dashboard. No page overflow or uncaught browser errors occurred. Desktop and phone screenshots were inspected. Verification scripts and screenshots remain in ignored `.preview.local/party-review/sheet-*` artifacts. No character data was changed by these checks. This remains a local preview only.

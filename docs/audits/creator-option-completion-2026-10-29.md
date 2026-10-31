# Creator option scope — local completion, 29 October 2026

Release follow-up: the creator scope and local repairs below are now published. See [the verified release and remaining limits](creator-option-release-2026-10-29.md). Earlier status statements are historical.

The remaining supported option-builder scope is implemented locally: durable choice groups, language/reference authoring and parent-aware subraces. This extends the feat/background and invocation/boon stages. The reproduced late-name creator failure and biography/notes payload omission are also corrected locally. No commit, push, deployment or production-data write is included.

## Choice groups

Workshop choice groups have stable UUIDs for offered options, explicit counts and optional nested groups. Validation bounds each tree to four group levels and 100 total options, rejects duplicate IDs/cycles, and checks names, descriptions and supported Benefits. Unfinished trees remain device drafts; publishing requires enough valid options for every count. Existing revision/hash checks, ownership, backup and supported draft/pack recovery apply.

The creator/editor share the lazy **Browse character options** picker. Selection requires confirmation of the class/table grant and an acquired level. Every active group must have exactly its allowed number of selected options. Duplicate, unknown and orphan IDs reject on the server as well as in the picker. These selections do not consume feat opportunities.

Only selected parent/child Benefits enter the existing calculation engine. Offered alternatives are never all granted. Future acquired levels keep grants inactive. Characters store selected child IDs alongside the versioned definition reference; their approved tree and supported rules remain in the reviewed snapshot.

Choice editing uses that approved tree. Source changes do not silently replace grants. Removing a selected child, changing a required count or removing the tree blocks source review until repaired. The character can choose a surviving alternative in its approved tree, then review the new source. If no compatible repair exists, remove/save the selection before adding the new definition. Missing packs preserve approved rules and show a warning.

Legacy imported selections remain descriptive: free-form option names do not acquire invented counts or automatic grants. A deliberately structured personal edition can use selected child grants. Existing descriptive/class-feature choices are not silently migrated. Arbitrary prerequisites and class allowance progression remain table-reviewed rules.

## References and parent-aware subraces

The authoring shell now creates languages and miscellaneous references, retaining language type, script and typical speakers. Saved languages appear in the existing creator language list; explicitly granted reference features use the manual picker. Languages remain learned names, not feat opportunities or a new progression system. Unambiguous learned language definitions cross the room boundary. If a source disappears, its learned name remains; an unreviewed description is not represented as a pinned grant snapshot.

Subrace authoring requires an available owner-imported or standard parent. It stores additional ability bonuses, optional speed override, descriptive traits and supported Benefits. Creation resolves parent IDs/content keys/aliases, adds parent/subrace bonuses once, inherits parent speed when appropriate and saves the subrace ID. Equal parent display names do not establish identity. The server rejects a native subrace selected with the wrong parent. Recovery retains native identity and approved grants.

Editing adds a saved-subrace selector filtered to the parent. Linking adds copied traits and supported references. Existing ability scores, speed and old copied traits require manual review when changing ancestry; the selector does not subtract/reapply ancestry bonuses. Source review is blocked if a changed native subrace no longer fits the character's parent. This does not introduce a universal ancestry replacement engine.

## Creator and room corrections

The late-name failure was reproduced after imported ancestry, class/subclass, spell and six modal item additions, including a duplicate weapon. The visible input stayed empty and hit testing returned the workspace. A keyed chapter DOM subtree resolves the workflow while retaining the reactive draft. The final regression fills, clicks and types into the late name field, switches chapters, reloads the draft and actually saves the imported character. No underlying browser-engine defect is claimed, and no global motion preference was changed.

Inventory render keys now distinguish instances sharing an imported definition ID. The item composer's damage-dice HTML pattern uses browser-valid syntax, removing the observed console warning. This does **not** resolve the separate fixed-damage/special-weapon grant validation findings.

The editor includes `personality` in its save payload. Owner/player reads verify notes and backstory persistence. Existing merge logic for live HP, resources, prepared spells and inventory counters remains in place.

Assigned players receive selected choice, reference and subrace definitions without importing the owner's packs. The older per-category room endpoint now shares the selected projection, excluding unrelated same-name groups. Non-rule inventory references use IDs or an unambiguous legacy fallback. Both endpoint forms retain assignment revocation. Owner reference projection advances to `selected-options-5`; optional new arrays are validated before disk reuse. Room responses remain outside persistent owner caches.

## Verification

- Production frontend build and frontend/server type checks pass. Workspace suite: **647 passed, 55 skipped, zero failures**.
- **23 isolated API scenarios pass**: prior-stage regressions, new kinds, nested grants/counts, parent mismatch, selected-only player references, same-name isolation through both room endpoints, blocked/repairable reviews, recovery and revocation.
- **14 desktop Edge scenarios pass** against the compiled frontend and local Express/MongoDB: authoring/reopening, draft reload, nested selection, completed creation, editor choice changes, player selected-child text, source-alias choice editing, biography/notes and the longer imported creator regression. No JavaScript exceptions, console warnings or failed API responses occur in the final run. Scenarios contain multiple assertions.
- Fixtures use synthetic accounts/content and fictional standard Human/Fighter responses. The longer creator uses synthetic imported ancestry, class/subclass, spell and five item types. This is local verification, not a fresh production/private-library audit. Both databases report cleanup; browser contexts and fixture servers close.
- Source backups, fixtures, JSON reports, diagnostics and inspected screenshots remain ignored under `.local/creator-finish-20261029/`. Final success is in `tests.json`, `integration-results.json` and `ui-results.json`; intermediate failures remain diagnostic history.

## Payload measurements

The integrity-verified 23 October snapshot of 126 packs contains 71 selections, 36 languages, zero miscellaneous entries and 244 subraces. The expanded server catalog serializes to 5,222,217 bytes versus 4,437,892 for the preceding eight categories: **784,325 additional bytes, about 17.67%**. This is composed catalog size, not MongoDB wire transfer or measured latency. Full-library fallback already contains these categories; the prepared reader's expanded scope needs hosted performance verification.

The manual picker sends four selectable categories and only consumed fields, including prerequisites and structured trees. Its snapshot response is **84,145 bytes / 13,837 gzip bytes**, avoiding the naive expanded response's 439,130 / 64,932 bytes. Raw pack trees are omitted. It remains deferred until Browse; automatic Compendium preparation is separate.

Direct lazy assets: manual picker JavaScript 8,087 bytes / 3,284 gzip, CSS 780 gzip; Workshop gallery JavaScript 11,941 bytes / 4,558 gzip, CSS 266 gzip. These exclude shared dependencies and are not an exact-live comparison. No hosted loading-time gain is claimed.

## Release boundary

The staged option-authoring scope is complete locally within the manual-rule and ancestry-change limits above. Special imported-item validation remains a separate open audit item. This does not automate every imported game rule.

Publishing still requires reconciling Git/live sources, constructing an isolated candidate excluding unrelated extension/editor/cache work, measuring that candidate's dependency/transfer cost and hosted verification. Existing automatic preparation and retained selective-cache work are preserved; release guards were not weakened.

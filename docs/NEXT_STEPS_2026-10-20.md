# Follow-up priorities — 20 October 2026

## Imported-pack preparation - published 1 November 2026

[Automatic changed-pack preparation is live and publicly verified](audits/automatic-pack-preparation-2026-11-01.md). Imported source is preserved; exact current changed packs prepare after successful mutations or permitted idle checks, with durable jobs, storage limits, reader grace and the existing fallback. In the controlled delayed two-pack rebuild, the identical response fell from 27.93 to 4.29 seconds (84.66%); this is not a promised saving for every entry click. All 728 standard and 12 isolated queue tests pass, as do hosted/public cold-worker, freshness, access, character, rule and map checks. The paused-check status/resume UI remains a separate follow-up; unfinished Owlbear remembered login remains excluded.

## Added follow-ups - 1 November 2026

[Map-opening recovery is published and publicly verified](audits/map-opening-recovery-2026-11-01.md), following a fresh review with safer startup diagnostics. The first candidate was withheld after Owlbear pairing-index initialization returned 503; the new candidate passes all boundary, character, map and player checks. The [separate startup investigation](audits/owlbear-startup-recovery-2026-11-01.md) reproduces a cached transient initialization failure; its narrow readiness-recovery fix is also published and publicly verified. Validation includes 710 standard tests and all 44 isolated extension lifecycle tests. Permanent initialization errors still fail closed. The unfinished remembered-login feature remains separate.


## Added follow-ups — 31 October 2026

The retained local website rollout is live with passing public checks; unfinished Owlbear authentication remains separate. The first performance candidate was rolled back after a public extension initialization failure; the revised combined package passed the public gate. An isolated release branch now reconciles the deployed website source and its tests without overwriting the original working checkout. See [rollout status](audits/local-only-rollout-2026-10-29.md).

The subsequent authenticated loading investigation sampled all 14 populated Compendium categories and opened Revalon Kampány's actual continent map. The reference renderer was a small part of measured first-open time; current server/data waits dominate. The map's metadata, image decoding and normal dialog opening succeed now, so the earlier failed-fetch cause is not proven. See [timings, scope and narrow follow-ups](audits/loading-investigation-2026-10-31.md). Next candidates are server cold-path tracing and clearer map transport recovery; no speculative map change has been published.

The follow-up long-wait investigation reproduces a full-library rebuild after one large pack's preparation becomes invalid, plus an interactive SRD lookup delayed by queued imports. [Controlled calculations and remaining requirements](audits/compendium-tail-latency-2026-10-31.md) distinguish these from the live samples, which did not reproduce an exceptional wait. The [queue fix is published and publicly verified](audits/srd-queue-release-2026-10-31.md). The [bounded changed-pack fallback is also published and publicly verified](audits/compendium-mixed-fallback-2026-10-31.md): it reuses verified unchanged catalogues and reads only one eligible changed pack. All 15 category indexes match, 681 tests pass, and the delayed cold-rebuild comparison improves from 27.90 to 7.44 seconds; this is a controlled scenario, not a promised ordinary saving. Automatic stored preparation remains a possible later step requiring storage/job-lifecycle controls.

## Added follow-ups — 29 October 2026

These items are tracked alongside the remaining performance improvements. Work started locally on 29 October; the creator scope is now published as recorded below. The subsequent Workshop UI and imported-item fixes are also published, with release evidence below.

- **Character option builder — published:** Feats, backgrounds, invocations, boons, durable nested choice groups, languages, reference entries and parent-aware subraces are connected to drafts, pack persistence, recovery and their character consumers. Changed choices and mismatched parents cannot silently replace approved grants. Manual-rule and ancestry-change limits are explicit. Build, frontend/server type checks, 650 tests, 23 API scenarios and 14 desktop scenarios pass. Notes/backstory saving and the reproduced late-name creator failure are corrected in that release. See [completion evidence, payload costs and limits](audits/creator-option-completion-2026-10-29.md) and [the staged plan](CHARACTER_OPTION_BUILDER_PLAN_2026-10-29.md). Published from the exact audited source package; [release evidence and source limits](audits/creator-option-release-2026-10-29.md). Hosted owner/player checks pass. Git/live reconciliation remains; the separate special-item validation fix is also published and verified.
- **Workshop UI consistency - published:** All six categories share aligned search, contextual New actions, type filters, headings and cards. Draft/pack save controls sit below the category tabs; account-library saving remains intact. Backup feedback is visible across categories and active drafts are flushed before export. Exact-source build/types, 12 local scenarios, nine hosted scenarios and public checks pass. See [the release and rollback evidence](audits/workshop-ui-release-2026-10-29.md). The subsequent imported-item fix is also published.

Special imported-item validation is published: all 6,603 snapshot items pass, including the former 47 failures. The exact five-file change is merged onto the live Workshop release; hosted owner/player, cleanup and public checks pass. Existing inventory copies retain their saved rules. See [the release and rollback evidence](audits/imported-item-release-2026-10-29.md).

## Dashboard and DM room character workspaces

**Status:** Implemented and published on 21 October 2026. See `DASHBOARD_ROOM_WORKSPACE_RELEASE_2026-10-21.md`.

**Authorization:** The user confirmed “Yes—implement and publish”, then requested the same layout principles and animations for the DM view inside rooms.

### Selected direction

- Keep the character roster on the left of the dashboard.
- Open the selected character's complete sheet on the same page, with its existing tabs and controls.
- Keep character import and creation tools accessible from that dashboard.
- Allow the roster to collapse to give the sheet more room.
- Use Flowing motion for sheet tabs, descriptions, buttons and resource updates.
- Use Expressive motion for character switching, roster collapse/expansion and import panels.
- Respect reduced-motion preferences and keep interactions independent of animation completion.

### Starting references

The layout and motion demonstrations use illustrative data and are not the production implementation:

- Layouts: `C:/Users/PC/.codex/visualizations/2026/10/17/01a14b8c-9c21-7ff0-81a5-3ba2f85c5819/dashboard-character-workspace.html`.
- Motion: `C:/Users/PC/.codex/visualizations/2026/10/17/01a14b8c-9c21-7ff0-81a5-3ba2f85c5819/dashboard-workspace-motion.html`.

The implementation embeds the existing sheet and import flows, confirms before discarding unsaved edits, and waits for ongoing saves before switching. The DM room shares the searchable, collapsible roster and adds an assignment control beside the selected sheet. Player preview remains available. Git checkpoint: `pre-dashboard-workspace-2026-10-21`.

The sections below are earlier follow-up context.

## Character editor

The user clarified that the top navigation and bottom save/discard panel should match the middle panel's width. The correction uses the existing 880px width, and editor navigation styles now load with the editor rather than depending on the Game Room stylesheet. This is a small alignment correction; a broader editor redesign was not requested.

## Loading and caching

Continue investigating the loading improvements discussed in chat. Current findings:

- Standard SRD requests already have an in-memory cache for the open website.
- The sheet-local reference cache is discarded on unmount.
- Opening a character clears the current sheet and requests a fresh quick snapshot.
- Reference hydration watches `updatedAt`, so ordinary resource saves can trigger another reference request.
- The quick snapshot includes a Workshop library revision marker, which can help distinguish rule changes from play-state changes.

The first caching pass retains exact-version reference responses in bounded session memory and avoids reference reloads for ordinary play counters. Fresh authorized character reads and all server save paths are retained. Loading history tracks the sheet and references separately. See `SHEET_CACHE_AND_TIMINGS_2026-10-20.md`. Persistent character snapshots remain a possible later step requiring a separate decision.

## Compendium — after the editor

The right-hand detail panel now has the same 70vh height limit and independent scrolling as the result list. It supports keyboard focus and resets to the top when selecting another entry.

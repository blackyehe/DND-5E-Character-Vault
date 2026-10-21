# Bestiary reader and selection feedback

Implemented 22 October 2026.

## Requested changes

- XP earned and Add XP now stretch to the same height, with shared minimum
  height, vertical padding and line height. The rule applies to both sheet
  layouts and retains wrapping at narrow widths.
- Compendium folders reveal their choices with a short opening animation.
  Selecting a list entry immediately marks that entry and animates its active
  marker. Reader motion applies to the inner content, keeping the panel border
  and scrollbar stationary. Loading state is exposed with `aria-busy`.
- Existing reduced-motion preferences disable the new CSS animations; reader
  motion uses the existing site directive and its preference checks.
- The shared monster reader now follows the visual direction of the
  [5etools bestiary](https://5e.tools/bestiary.html#aboleth_xmm): flat parchment,
  burgundy section rules, compact tables and restrained gold outer borders.
  It fills the available reader width up to 760px rather than stopping at 400px.
- Ability tables separate scores, modifiers and recorded saves. Missing values
  remain unknown. Physical and mental rows have distinct muted backgrounds.
  Narrow readers stack the tables. Traits now have a visible section heading.
- The Compendium and Workshop use the same component. Workshop edit targets,
  source attribution, original reference details and missing-data notices remain.

No data schema or database changes are involved.

## Review

- Frontend typecheck and production build passed; whitespace review passed.
- In the actual Summary component, XP input and button both measured approximately
  40px high, at the same vertical position, in Classic and Folio layouts.
- The real reader rendered saved local Goblin data. Ability tables had no
  horizontal overflow at reader widths of 680px, 360px and 280px.
- The Compendium folder reported the expected 220ms opening animation after
  opening; the selected entry remained marked even when its detail request failed.
- Local review used an ignored fixture page and existing disposable sample data.
  No production characters were changed. Automated test suites were not run.
- Collaborative browser screenshots repeatedly timed out; DOM layout measurements
  were available. This pass does not claim a completed screenshot review.

## Future image import: proposed approach, not implemented

The user requested an assessment of importing monster statblock images. This is
feasible as a reviewed import into the existing monster builder:

1. Upload/crop the image, then run OCR with layout information. Browser OCR is a
   possible free first approach; [Tesseract.js](https://github.com/naptha/tesseract.js)
   supports images in browsers and Node.js. No OCR package was added in this pass.
2. Map the extracted text into the existing monster draft fields, preserving the
   raw extraction and indicating uncertain or missing values. Keep action text
   even when structured attack/save/damage fields cannot be established.
3. Show the image alongside the draft and existing builder review. Validate AC,
   HP, ability scores, save bonuses, CR, dice expressions and action sections.
   Do not silently fill cropped or unreadable sections.
4. Check normalized names, source/edition and content fingerprints against the
   accessible monster libraries, including imported packs. Exact duplicates can
   be skipped; possible collisions require a choice rather than an overwrite.
5. Publish a valid, reviewed new draft through the existing Workshop save flow
   when no unresolved collision remains. It then appears in the monster list.

OCR cannot promise perfect extraction from every image. Screenshots, scans,
multi-column layouts and unusual notation need representative examples before
choosing the extraction engine. Displaying the full text is a different milestone
from reliably automating every described combat rule.

## Rollback

Pre-change Git commit: `6c5c784`.
Pre-change production deployment: `dpl_3ETa93UDLMNfgqDoN8CaHVjMvNmH`.

Backup tag: `backup/pre-bestiary-reader-motion-2026-10-22`.

## Published release

- Feature commit: `9cc380b`.
- Published 22 October 2026 at https://dndoldal.vercel.app.
- Ready deployment: `dpl_D7MNP2Sjqqrg4UQoNR9C9tSiVW3F`.
- Deployment URL: https://dndoldal-gvipqxf8e-dndenjoyerstudio.vercel.app.
- After promotion, the public alias resolved to this deployment. The home page
  returned HTTP 200; `/api/health` returned HTTP 200 with `{"ok":true}`.
- The previous deployment is retained. To restore it:

```powershell
vercel rollback dpl_3ETa93UDLMNfgqDoN8CaHVjMvNmH --scope dndenjoyerstudio --yes
```

## Night Mode correction — 22 October 2026

The user selected the reference site's dark theme. The shared reader now uses
5etools' standard Night Mode palette: background `#222222`, body text `#bbbbbb`,
gold headings/rules `#d29a38` and grey outer borders `#565656`. Ability rows and
modifier/save cells use the reference's separate translucent grey fills. Table
labels use a brighter `#aaaaaa` for readability. Workshop edit feedback uses gold.

The local component's computed background, body text and heading colours matched
the inspected reference. Production build and whitespace review passed. This is
a CSS-only correction shared by Compendium and Workshop, with no data changes.
Pre-correction Git commit: `0bef2b8`; prior live deployment:
`dpl_D7MNP2Sjqqrg4UQoNR9C9tSiVW3F`.

Published correction: commit `8805fc5`, deployment
`dpl_5WGJo3563vgFPqHNSxksjg1xPoyp`, promoted to https://dndoldal.vercel.app.
The public alias resolved to the ready deployment; health returned HTTP 200
with `{"ok":true}`. The previous deployment and Git tag
`backup/pre-bestiary-night-theme-2026-10-22` remain available for rollback.

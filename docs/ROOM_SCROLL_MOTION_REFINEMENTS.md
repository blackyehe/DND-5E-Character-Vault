# Room width, scrollbar stability and motion

Requested 21 October 2026. Maps will have a separate room tab; that feature remains
planning only while these UI corrections take priority.

## Changes and reasons

- Removed the notebook-specific 1,200px room cap. The notebook and Characters
  sections now inherit the same room container, including the DM's 1,480px limit.
- Reserved the root scrollbar gutter across all routes, with an always-present
  vertical scrollbar as the fallback. Short pages, loading states and long pages
  therefore have the same available width. Overlay scrollbars follow the browser's
  own rendering behaviour.
- Reserved gutters on bounded vertical readers elsewhere: compendium panels,
  builder previews, spell and item pickers, notebook readers/history, sidebars and
  dialogs. Horizontal-only navigation and tables retain their existing layout.
- Extended the approved tactile control transitions to all native buttons and
  navigation links, covering previously unstyled compendium entry controls too.
- Reused the existing panel directive for route changes, room sections,
  compendium categories/entries, Workshop areas/content types, character-editor
  sections, item creator modes and login/register. Existing sheet, builder and
  notebook transitions remain in place. No route or form is keyed/remounted just
  to create an animation, and motion does not delay requests or saves.
- Retained the existing reduced-motion option and operating-system preference.
  No new page-load choreography or animation library was introduced.

## Review

- Frontend typecheck and production build passed. No automated test suites were
  added or run.
- Local review used the existing disposable notebook database and real Vue UI.
  At the desktop review size, Characters and Campaign notebook both measured
  1,432px inside the same 1,480px room. Neither had horizontal overflow.
- The compendium's page position and width remained unchanged between a long
  reference category and the short Homebrew files view. Root and reader styles
  reported stable gutters. Selecting Acid Arrow rendered readable spell content
  and started the existing 190ms detail-panel animation.
- Reduced motion reported zero running animations and a 0s control transition.
  The Workshop area switch still rendered its item controls correctly.
- The collaborative browser did not consistently apply its requested narrow
  viewport during this session; no new mobile visual verification is claimed.
  Existing mobile media/container rules are retained.

## Rollback

Previous deployment: `dpl_HMvHEsT4vtVGjudwhDw68noZrvzd`.
Git checkpoint: `26cafc5`, tagged
`backup/pre-room-scroll-motion-2026-10-21` before release.

```powershell
vercel rollback dpl_HMvHEsT4vtVGjudwhDw68noZrvzd --scope dndenjoyerstudio --yes
```

This UI release requires no database migration.

## Published release

- Feature commit: `8e1a63f`.
- Production deployment: `dpl_wqYDdj29jGM61DdGWBxciZcHe5DZ`.
- Deployment URL: https://dndoldal-9oo6ysj5f-dndenjoyerstudio.vercel.app.
- Public site: https://dndoldal.vercel.app.

Vercel's frontend build and server typecheck passed. After promotion the public
alias resolved to the new READY deployment. The page, stylesheet and health
endpoint returned 200, the public stylesheet included the stable gutter and
persistent scrollbar rules, and a signed-out notebook request returned 401.
Authenticated campaign data was reviewed only in the disposable local room.

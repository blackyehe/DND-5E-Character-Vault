# Sheet panel placement and compendium categories

Requested and implemented 21 October 2026. Maps remain deferred.

## Character sheets

- In DM rooms, the selected character's rules-review disclosure is now above the
  collapsed Players & assignments panel. The user confirmed that placement.
- The disclosure identifies the character. Review still opens that character's
  Rules & choices editor and retains the existing unsaved-edit guard.
- The room no longer renders a duplicate notice within the sheet. Standalone
  sheets retain their existing notice because they have no assignment panel.
- The Folio summary order is Statistics, Experience, Skills & proficiencies,
  Training & languages. Experience and Training use the full content-column
  width. Experience uses a wrapping inline layout for totals and XP entry.
- Removed the redundant Edit character button from Experience. Permanent editing
  remains accessible through the normal sheet tab.

## Compendium

| Top-level choice | Contents |
| --- | --- |
| Spells | Spells |
| Items | Normal items, Magic items |
| Classes | Classes, Subclasses |
| Races | Races, Subraces |
| Monsters | Monsters |
| Character options | Backgrounds, Feats, Invocations, Boons, Selections |
| Reference | Languages, Other reference |
| Homebrew files | Existing pack management |

All sixteen original categories remain available. Desktop uses one category
row with click-to-open folders. Search has its own full-width labelled field
below that row. At narrow widths, a native selector with category groups replaces
the row; search retains its own space.

Folder selection closes the popup and returns focus to its trigger. Escape,
outside pointer clicks and keyboard focus leaving the category navigation close
open folders. Native disclosure semantics and existing tactile button/panel
motion are preserved. Menus are positioned over content so opening them does not
push filters or readers downward. Existing category filters and readers are
unchanged.

## Review and rollback

Frontend typecheck, production build and whitespace check passed. No automated
test suites were added or run.

Manual review used the real local app and disposable notebook-review database:

- Statistics, Experience, Skills and Training measured equal widths; Experience
  followed Statistics and contained only the Add XP button.
- A disposable rule conflict appeared once, above Players & assignments. Review
  opened Edit character / Rules & choices. The fixture conflict was removed.
- All eight compendium choices measured at the same vertical position. The search
  field occupied the content width. Classes opened Classes/Subclasses; choosing
  Subclasses updated the search label, closed the popup and restored focus.

Git checkpoint before this work: `0e7c5eb`, tagged
`backup/pre-sheet-compendium-navigation-2026-10-21`.
Previous production: `dpl_wqYDdj29jGM61DdGWBxciZcHe5DZ`.

```powershell
vercel rollback dpl_wqYDdj29jGM61DdGWBxciZcHe5DZ --scope dndenjoyerstudio --yes
```

No database migration is required.

## Published release

Published and promoted to https://dndoldal.vercel.app on 21 October 2026.

- Feature commit: `81c1782`.
- Ready production deployment: `dpl_3ETa93UDLMNfgqDoN8CaHVjMvNmH`.
- Deployment URL: https://dndoldal-b4dfjqya9-dndenjoyerstudio.vercel.app.
- Vercel frontend build and backend typecheck passed.
- After promotion, the public alias resolved to the new ready deployment.
  The home page, stylesheet and `/api/health` returned HTTP 200; health reported
  `{"ok":true}`. The stylesheet retained the stable scrollbar rules.
- The notebook API returned HTTP 401 when signed out, as expected.
- The previous deployment and Git backup above remain available for rollback.

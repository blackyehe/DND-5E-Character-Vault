# DM Party dashboard directions

Four functional design prototypes, with the existing obsidian/crimson palette
and local Barlow typography. These are synthetic examples, not live sheets.
No application files, saved characters, authentication, or production data are
changed. The chosen design still needs integration with existing protected
Party reads, save/conflict handling, explicit party inclusion and real sheets.

Build the portable HTML after editing:

```powershell
python design/party-dashboard/prepare.py
python -m http.server 5190 --bind 127.0.0.1 --directory design/party-dashboard
```

- [One character](http://127.0.0.1:5190/#focus), recommended for quieter navigation.
- [Party ledger](http://127.0.0.1:5190/#ledger), for comparing saves across the party.
- [Check finder](http://127.0.0.1:5190/#finder), for ranking a chosen save or skill.
- [Foldout roster](http://127.0.0.1:5190/#foldout), one expanded training reference.

Use the four direction buttons, character search, sheet navigation and Back to
party. Preview options exercise long names, an empty party and larger text.
The sheet demonstrator preserves the collapsible chooser and adjacent sheet
layout accepted previously. It does not edit or roll anything.

`preview.html` is editable source; `prepare.py` embeds the existing local font
assets in `index.html`, which can also be opened directly or rendered inline.
`review.mjs` runs meaningful interaction/responsive checks using the established
local Playwright/Edge browser fallback. It requires the existing cached browser
library and Windows Edge, plus the preview server. It writes screenshots and
results to ignored `.preview.local/party-directions/`.

See [the design brief and review](../../docs/PARTY_DASHBOARD_DIRECTIONS_2026-10-22.md).

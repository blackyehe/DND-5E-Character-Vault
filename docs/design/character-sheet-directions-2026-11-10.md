# Character-sheet visual directions

First-round previews A/B/C were rejected by the user. The current comparison is
`character-sheet-backgrounds-2026-11-10.html` (D/E/F), awaiting a choice. The live
website is unchanged.

The brief is to replace repeated red outlines/dividers with a consistent way of
grouping information throughout the website and Owlbear sheets. These three quick
directions compare the same skills, saving throws and combat figures from the
provided reference. Six representative skills are shown to keep comparison short.

## Shared design plan

- Palette: inherit the selected theme. Existing dark-theme tokens are Canvas
  `#12191d`, Paper `#1c262c`, Soft surface `#243138`, Ink `#e8eee9`, Muted ink
  `#b1c2bf`, and Accent `#b2d69f`. The inline preview uses its host's equivalent
  semantic theme variables; it does not choose a new application palette.
- Type: retain Barlow Condensed 500 for section headings and Barlow for body/data.
  Use tabular figures for modifiers, and clear text for proficiency status.
- Alignment: left-aligned labels, right-aligned skill modifiers, a predictable
  three-column stat group, responsive down to two columns for skill lists.
- No shadows, decorative motion, repeated outlines, or new runtime dependencies.

## Directions and review

A — **Soft sections**: broad, quiet section backgrounds; subtle row tone changes
within skills. Closest to the current layout, with fewer visible boundaries.

    [ Skills                         ]
    [ name / training   +6 | ...     ]
    [ Saving throws                  ]
    [ STR +0 | DEX +3 | ...          ]

B — **Open spacing**: transparent sections, stronger headings and whitespace.
Numerical alignment provides structure without boxes or row separators.

    Skills
    name / training     +6   ...

    Saving throws
    STR +0     DEX +3     ...

C — **Grouped bands**: a toned section-label column beside compact content;
labels move above their content on phones. The contrast belongs to groups rather
than individual cells.

    [ Skills   ][ name +6 | name +1 ]
    [          ][ name +7 | name +8 ]
    [ Saves    ][ STR +0 | DEX +3   ]

Review against the brief: each changes the separation mechanism rather than
merely recolouring borders. Keep the user's existing typography and numerical
content, and avoid turning every statistic into an identical small card. These
are local reference previews, not three new settings to add to the product.

Open `character-sheet-directions-2026-11-10.html` to compare the three directions.
The HTML has no API requests, character writes, persistence or live-site effects.
It embeds the existing Barlow/Barlow Condensed Latin fonts for a self-contained
preview; their OFL notices remain in `src/assets/fonts/barlow/`. Visual checks:
all three directions at 728px, grouped bands at 390px, no console errors. Secondary
text was brightened and the grouped-label surface strengthened after inspection.

## Second round: backgrounds for every entry

The user liked stronger emphasis on proficient entries, but wants differing
backgrounds for the remaining entries too. All three new options shade every
skill, save and combat entry. Skill/save highlighting follows actual proficiency
and expertise rather than alternating row positions. Text labels retain that
meaning independently of colour, and highlighted text uses full foreground colour
for readability. The existing typography and numerical content stay the same.

- **D — Tonal tiles:** neutral untrained entries, an accent tint for proficiency,
  and a stronger tint for expertise. A restrained continuation of the first idea.
- **E — Soft colour:** cool untrained entries, muted green proficiency, and a
  warm expertise background. Otherwise the same layout as D for easy comparison.
- **F — Compact rows:** two skill columns and compact save rows, with neutral,
  lighter trained and strongest expertise surfaces. Section backgrounds are open.

The revised HTML reuses the embedded project fonts and remains a preview only.
Checked D/E/F at 728px and D at 390px, without console errors. No application
styles, calculations, campaign data or production deployment were changed.

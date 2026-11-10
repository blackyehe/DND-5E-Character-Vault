# Shared theme surfaces

The user likes the shaded expandable spell concept but finds the current neutral
grey unsuitable for their theme. They also intend the same treatment for all
comparable older rows, including Tough in Combat. This is a shared styling
requirement, not a spell-only change. The user selected C; it is implemented as a shared treatment across the
website and independent Owlbear sheet.

Current cause: SpellbookEntry and Summary shade paper with foreground ink, making
neutral lightened surfaces. SheetDisclosure separately uses older bordered styles
and has density/folio overrides. A shared surface/header/body/hover token set
should drive both implementations and comparable sheet entries. Preserve their
different controls, behaviour and semantics; consolidating colour does not require
rebuilding every component or adding user settings.

Plan: use the existing selected palette (canvas/paper/field/soft/ink) and raw
accent-solid, retaining full foreground contrast and brighter semibold labels.
Avoid mixing in the contrast-adjusted accent-text as a surface colour. Preview
palettes mirror Obsidian/Crimson, Dark/Ocean, Parchment/Forest and Folio/Violet from
useBuilderAppearance, including immersive tints. Typography and spacing stay close
to approved B/F; colour, not a new layout, is the decision. No new repeated border
lines, shadows, animations or runtime dependencies.

- A: soft tint, accent 8% over paper for headers and 3% over field for content.
- B: richer tint, accent 16% over paper for headers and 6% for content.
- C: inset rules, accent 10% over soft for headers and 5% over field for content.

The self-contained comparison shows an expanded spell, expanded feat, collapsed
class feature, and trained/untrained entries together. It contains no API calls
or persistent settings. Desktop dark and phone parchment/light checks have no
console errors. The comparison itself has no application/deployment side effects.

Before implementing/releasing, read the sibling Owlbear parity audit and retained
website overlay: current website production differs from this checkout. Existing
AGENTS.md/backlog modifications belong to that independent release and must be
preserved. The website and Owlbear should follow the chosen design consistently;
their independent deployments and rule-authority boundaries remain intact.


## Selected implementation

C supplies common entry, inset-body, hover, proficiency and expertise colours.
SheetDisclosure, spells, Summary entries, skills, equipment disclosures, resource
cards and feat facts consume those tokens. The older folio/density appearance
rules are superseded without changing their controls or permissions. Metadata is
kept at full foreground contrast. Extreme custom accents receive a bounded
highlight lightness; standard presets retain their selected tint.

The canonical stylesheet is src/components/sheet/sheet-surfaces.css. Owlbear keeps
an identical standalone src/sheet-surfaces.css because its build must not depend
on the sibling repository. Preparation and colour checks compare their bytes;
future edits must mirror this file and release both applications together.

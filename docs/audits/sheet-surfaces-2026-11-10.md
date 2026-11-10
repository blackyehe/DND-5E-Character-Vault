# Shared C sheet surfaces - 10 November 2026

The user selected C: theme-coloured headers with deeper inset rules. Shared
entry/body/hover/proficiency tokens now drive spells, feature/feat/training
disclosures, Summary skills/saves/combat entries, skill rows, equipment disclosures,
resource cards and feat facts. Folio/density geometry and controls remain; older
borders and separate fills are superseded. Labels stay bright. No calculations,
permissions, write scope or rest policy change.

Canonical CSS is `src/components/sheet/sheet-surfaces.css`. Owlbear keeps an
identical standalone `src/sheet-surfaces.css` because its build is independent.
Preparation/colour checks require byte equality. Future changes belong in these
shared tokens rather than per-component colour formulas. Owlbear's existing local
theme boundary stays; no account-preference synchronization is added.

Colours derive from palette soft/field surfaces and the raw accent, avoiding
foreground mixes that washed cards towards grey. Modern relative-colour support
bounds highlight lightness for extreme custom accents; standard presets retain
their selected tint. The fallback uses the raw accent. Metadata uses full
foreground contrast. The retained comparison records the user's C selection.

The release reconstructs exact website parity deployment
`dpl_DZU1MAhtzZbrv4gnSKe6C2uwE4Ai` (560 inputs), preserving its API overlay and
all unrelated/unpublished checkout differences. Five frontend files change. The
extension changes only its main stylesheet import and the shared stylesheet;
all other inputs match its frozen parity review. Release profile, website origin,
manifest/config/security headers are retained. No campaign saves, account grants,
provider settings or production extension application probes occur.

Passing checks: 19 focused website tests, both website type checks/build;
117 extension tests, extension types/game build; 36 headless synthetic CSS
cascade/contrast scenarios using actual built styles at 390/1100 widths,
classic/folio layouts, five standard palettes, three extreme custom accents and
Owlbear's website preset. Matching spell/feature headers and bodies resolve to
identical colours. Measured foreground contrast is at least 4.746:1. This is
synthetic verification, not a live Owlbear-room/gameplay check.

An initial candidate was staged but never activated. Expanded custom-accent
checks rejected an intermediate highlight at 4.471:1; bounded lightness and
full-contrast metadata corrected it before final submission. Each candidate has
separate immutable preparation/submission markers. Unused initial staged IDs:
website `dpl_JDL3Wyj2irNe1PNqTPnHG4qxujfC`, extension
`dpl_2mJ88FKxhA6QMsDbtPYHt8azpBuF`. Preserve completed markers. An initial
metadata 403 recovered through the installed CLI's normal credential refresh;
a preparation-helper initialization error/missing Git preimage were corrected
before passing frozen checks.

Final receipts/tooling: website `.local/sheet-surfaces-c-release-20261110/`,
extension `.local/sheet-surfaces-c-release-20261110/`. Website preimages also
use `.local/sheet-surfaces-20261110/baseline-files/`. Intermediate sheet-surfaces
directories retain small candidate/diagnostic evidence. Review on 10 December
2026. Managed temporary sources/profiles reuse dependencies and close contexts
before cleanup. Existing unrelated AGENTS/backlog edits are preserved.

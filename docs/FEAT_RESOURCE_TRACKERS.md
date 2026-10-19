# Automatic feat trackers

Feat resources share `resourcesFor` with class resources. Combat, the spell tab,
creation, the resource editor, authenticated quick sheet reads, fully resolved
sheets and room player actions therefore use the same grants and limits.

Existing characters need no migration or feat reselection: trackers derive from
saved feat features or legacy `Feats` lists on read. This never waits for a pack
download. Individual definitions override duplicate legacy names; gained level
is respected. New selections update the resource editor immediately. Removing
an individual feat also removes its duplicate legacy-list entry.

The 2014-era rule shapes come from the supplied Orcbrew definitions. They include
Lucky, Metamagic Adept, Martial Adept, spell-granting feats, Second Chance, Chef
and the dragon gift feats. Lucky's saved proficiency-based rule (or an explicit
2024 name-only selection) uses proficiency instead of the legacy three points.
Custom feat descriptions also support explicit fixed pools, proficiency/ability
use counts and unambiguous once-per-rest abilities. This is not a general rules
language interpreter: ambiguous descriptions, several unrelated custom pools,
target-specific limits and variable-sized psionic dice require a custom tracker.
No new personal pool is invented for Healer, Inspiring Leader or Dragon Fear.

Stable `auto:feat:` IDs preserve spent uses across reloads and rule recalculation.
Automatic maxima follow level and abilities; existing manual overrides remain.
Matching hand-made trackers are retained without adding a duplicate. Restricted
Metamagic Adept points stay separate from unrestricted class sorcery points.
Free spell casts have separate counters rather than granting ordinary slots.
Rest controls recover each pool according to its own recovery rule. Chef treats
require manual preparation/recovery; Second Chance mentions initiative recovery.

The server derives these same resources before validating player actions; clients
cannot choose their maximum. Players can spend/recover granted uses without
being allowed to edit the feat or the permanent rules. Player preview changes
remain local to the preview.

Read-only audit of the six existing backup characters (19 October 2026):

| Character | Newly derived feat trackers |
| --- | --- |
| Fade | Lucky: 3/long rest; Shadow of Possibility: 1/long rest |
| Ashton Hollowborne | Metamagic Adept: 2 restricted sorcery points/long rest |
| Volenta | Arcanist: Detect Magic, 1/long rest |
| Melina | Magic Initiate: chosen first-level spell, 1/long rest |
| Kaylee, Lortar | No separate limited-use feat pool in their saved definitions |

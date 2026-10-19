# Race Workshop

The Homebrew Workshop supports creating races and editing imported race entries,
using the same pack selection, revision, export, and backup flow as class content.

Race rules include character-level traits and choices, resource trackers, speed,
size, vision, languages, skill/tool/weapon/armour training, ability bonuses,
resistances, immunities, natural-armour notes, and innate spell grants. Innate
spells have their own section on the sheet and do not change class spell choices
or slot progression. Limited casts can use the race's resource trackers.

Imported races are also resolved directly for existing characters before their
first Workshop save. Identical imports share stable identifiers. Ambiguous race
names require a definition selection in Edit character. Other imported property
and choice fields remain readable as an additional racial-rules feature.

Published revisions update all matching characters belonging to the pack owner,
including their assigned Game room sheets. Updates preserve scores, HP, spent
uses, inventory, and selections. Changed ability bonuses are review conflicts;
they are never added to an existing score automatically. Changed training keeps
prior proficiencies for review. Custom movement speeds and edited trait text are
preserved when they conflict with revised rules. Race grants use character level.

Shadow Touched's Mage Hand, Misty Step, and Darkness unlock at level 1, as confirmed
by the DM. Their casting limits are still marked for review. The imported
Lizardfolk natural-armour flag is shown as a rule needing a confirmed formula;
the character's AC is preserved. Dawnwalker Vampire's Charm Person and Friends
remain visible with their original INT casting ability, with missing casting
rules marked for review rather than invented.

The source audit covered 102 imported race definitions and the six migration
characters. Shadow Touched (Fade/Lortar) and Dawnwalker Vampire (Volenta) resolved
their grants; HP, ability scores, and class slots were preserved. In-memory
revision reconciliation and Orcbrew round trips were checked without modifying
the production characters or packs.

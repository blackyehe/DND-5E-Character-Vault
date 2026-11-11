# Simpler existing-character updates — 11 November 2026

The user found the current saved-definition version flow too convoluted and
authorised simplifying it: Update existing characters beside Save, concise
comparison, one explicit confirmation. Volenta's two Zhaerin Prison trackers are
the concrete example. No live campaign application is authorised by this coding
task; test with isolated fixtures and leave the user's actual choice to the UI.

Current friction: ItemComposer closes after save; ItemWorkshop places review below
the whole library. DefinitionChangeReview then requires Find affected characters,
opening the character details, a source checkbox and a separate apply action.
Compendium, option/spell Workshop and sheet updates reuse that component; native
class/race definition review remains available through Compendium.

Two quick presentation choices reuse the current C theme and existing forms:
A shows the comparison inline below the save actions; B uses a focused window.
Both load the affected characters immediately when Update existing characters is
clicked, show added tracker names/uses/recovery/activation and meaningful before/
after stats, and keep full differences available. The final Update button is the
single deliberate source/update confirmation. Drafts must be saved first.

Implementation should reuse the current guarded review/apply endpoints, preserving
ownership, current definition revision, exact character version, server review
hash, blocked-selection checks and atomic per-character application. Do not replace
these with blanket live propagation. The final button can explicitly confirm
the intended source in its copy and existing confirmedSource payload; a separate
checkbox is not an independent server requirement. Material warnings remain visible.

For multiple characters, let the user choose which outdated sheets to update.
Reuse individual guarded writes; report successes and failures truthfully, stop
on stale/ambiguous failures and never silently replay a save. Handle account/source/
draft changes, unmounts and late responses without enabling stale confirmations.
Keep spent counters, HP, inventory state, choices and approved unrelated rules.

Keep the saved item editor available after saving and retain fresh returned item/
definition revisions so subsequent saves cannot use stale initial props. Consider
placing the update entry point in the item library as well, so it is discoverable
without making a new edit. Sheet pending updates should open the same comparison
without another Find step. Unsaved/busy drafts invalidate the preview.

The user selected A. Keep the comparison inline, bring it into view after loading,
and keep full details available without requiring them to be opened. The actual
implementation uses the existing guarded endpoints; no backend changes are needed.
Release from the exact
568-input width-only boundary dpl_DeG256XUPhRvkWF5yUFi2eeV1Bdp, preserving parity
backend and independent Owlbear aliases; never deploy the checkout wholesale.

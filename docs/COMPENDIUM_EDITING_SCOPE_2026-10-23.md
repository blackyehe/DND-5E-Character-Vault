# Compendium editing

Status, 23 October 2026: implemented and verified locally after the Party readiness handoff. The user selected updates to existing characters with an explicit review step.

All 15 Compendium rule categories now have an Edit entry action. Homebrew Workshop exposes the same editor through All Compendium entries. Personal editions preserve source identity, unknown fields, original files and character references, with conflict checks, source comparison and source restoration.

Saving an edition changes the Compendium. Find affected characters then shows current/proposed values and warnings. Each sheet requires explicit source confirmation and Apply. Approved snapshots stay fixed until another review; restoring the source also requires review before changing a character. New characters can use this same review workflow.

Classes, subclasses and races use the existing Workshop reconciliation engine. Other categories update matching source-backed feature text, item rules or per-character spell/reference definitions. Custom values and play counters are preserved. Arbitrary prose, ambiguous grants, removed generic features and player choices remain manual review items, explained in the interface.

The candidate uses live Party deployment dpl_7tHoxpxAXpXgmjr4eqcntDzEXkNV. Its audit preserves 304 inputs, changes 11 and adds seven (322 total). Production remained on that baseline at the final audit. No promotion or production data writes were performed.

Evidence: .preview.local/compendium-editing-20261023/. See [implementation and validation notes](COMPENDIUM_EDITING_IMPLEMENTATION_2026-10-23.md).

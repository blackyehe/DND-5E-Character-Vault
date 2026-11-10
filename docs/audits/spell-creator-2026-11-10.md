# Homebrew spell creator — 10 November 2026

Homebrew Workshop has a Spells section using the existing Compendium EntryBuilder
and spell form, validation and projection. It supports casting details, classes,
damage/healing scaling, areas, Benefits, device drafts and pack saves. No separate
spell form or new visual design was introduced.

Native spell metadata preserves all builder fields in the pack. The ordinary and
background parsers project the same spell fields; cantrips use character-level
scaling and leveled spells use slot scaling. The spell projection was extracted
into a small pure shared module so the parser worker does not import server
validation dependencies. The checked-in worker was regenerated and verified.

Publishing uses owner-scoped reads and existing pack hash/revision/atomic-update
guards. It reads prepared spell categories when available and only the target
source when saving. Successful saves update the local pack hash immediately.
Conflicts retain the draft. Saved edits offer the existing character review flow.
For native spell revisions, reviewing relinks the same spell's known/prepared/
active references and replaces its approved definition; it does not learn another
spell or reset spent slots. No characters are rewritten during deployment.

Spell drafts participate in device backups and Recently deleted. Native pack
spells can be deleted/restored through the existing exact-source archive controls.
The broader personal Compendium edition/native Workshop reconciliation is still
at its explicitly deferred resume point.

Working checkout: 1,181 tests passed, 67 optional/environment tests skipped;
frontend and server type checks pass. Targeted final worker/spell/backup checks
also pass after the parser's ordinary-import fast path was retained.

Release isolation uses `scripts/releases/spell-creator-2026-11-10.json` with
`scripts/releases/validate-character-option-review.mjs`. Concise source manifests
and receipts are kept in `.local/spell-creator-20261110/`.

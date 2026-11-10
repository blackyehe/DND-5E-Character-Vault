# Definition synchronization - 10 November 2026

Website candidate prepared against `dpl_2uySpBC89mtPVjThordZcZn2wy2Y`.

Compendium and native Workshop definitions share a stable edition identity.
Native option/spell UUIDs, class/race Workshop IDs and item template IDs survive
fingerprint changes. Legacy editions are adopted by their latest save; once
adopted, the canonical edition takes precedence. Older records remain for recovery.
Approved character references also match stable IDs after old aliases expire.

Both editors read the same effective fields and Benefits. Native saves update
source and edition atomically. Personal edits and character applications share a
write fence with native saves; transaction retries recheck the original revision.
The fence does not change source timestamps or invalidate prepared source caches.
Pack hashes, native revisions, owner scope and character version guards remain.
Empty editions are retained, including explicit benefit removal.

Item/class publishing now offers the same explicit affected-character review as
options/spells. Saved class bindings remain pinned until review; opening a saved
class card loads its saved edition, keeping private device drafts separately.
New acquisitions capture current definitions. Item copies capture source values
on delivery/review so later updates preserve per-copy custom values. Legacy copies
use the earliest available definition baseline and require source confirmation.
Earlier undocumented custom changes cannot always be distinguished from old source
values; inspect the concrete comparison before applying it.

The website sheet reports pending or missing approved sources. Room reads use the
existing membership/assignment boundary. Players receive notices; permanent
review/apply remains owner/DM only. The sheet review is limited to that character.
No rest, tracker lifecycle or visual redesign is part of this release. Independent
Owlbear deployment aliases are preserved.

Validation uses `scripts/releases/definition-consistency-2026-11-10.json` with
`scripts/releases/validate-character-option-review.mjs`. Selected evidence is in
`.local/definition-consistency-20261110/`. Hosted preimages were checked. The
shared character type differed only in mixed line endings. ItemWorkshop's
previously unpublished concurrent loading/abort guard is deliberately included:
its post-save review must not receive a stale library response. Its focused tests
are included. Other checkout changes are excluded from deployment.

The database runner uses a local, managed disposable replica set and closes its
HTTP server, connections and MongoDB process before cleanup. Tests cover both
editors, stale/concurrent saves, rollback, legacy edition adoption, acquisition,
explicit bonus removal, source deletion, class/resource pinning, item fields and
room assignment permissions. The Volenta-style fixture verifies spell attack/DC
from +11/19 to +12/20 and back to +11/19, preserving HP, spent uses, equipment and
slots. No actual Volenta or Zhaerin campaign record is changed by tests or release.

Final validation and deployment receipts follow after promotion.

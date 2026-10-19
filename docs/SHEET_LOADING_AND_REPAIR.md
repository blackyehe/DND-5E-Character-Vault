# Sheet loading and spell repair

Sheets fetch one character-scoped homebrew reference bundle instead of six full
catalogues. Game-room references retain the membership, assignment, and ownership
checks and include only definitions used by the assigned character. Editor-only
catalogues load on entering Edit and require ownership.

The server caches assembled libraries per owner, coalesces concurrent work, and
checks small database revision records on every use. Pack changes invalidate the
cache through IDs, update timestamps, source hashes, and disabled-content flags.
The bounded cache retains at most four owners. No private responses are publicly
cached. SRD requests share an in-browser cache and render as each lookup finishes;
interactive proxy requests have a short timeout and do not use import retries.

A bundled 2014 SRD snapshot serves spell/equipment lists and definitions locally.
Character reference bundles also include needed standard spells, avoiding separate
network lookups. The data sources and notices are in server/data/README.md.

The import-library sample previously supplied approximately 4,295,789 bytes of
homebrew JSON per sheet. Before progressive opening, reference-only bundles ranged from 19,664 to 41,627
bytes for the six migration characters, including their needed standard spell
definitions, before HTTP compression. Fade’s bundle is 36,737 bytes. This measures
payload reduction, not a guarantee of latency on all devices or cold instances.

The DM room uses a top character selector. Players, assignments, invitation
controls and rule-review differences are collapsible. Character summary is the
first tab and the DM's default opening page (confirmed 19 October 2026).
Players retain their assigned-sheet access and existing play permissions.

Edit has separate sections for identity, rules, stats, equipment, spells,
resources, features, and notes. Spell preview links open the repair section.
Replacing a definition preserves prepared status and removes duplicate IDs; the
change remains a draft until Save character. SRD choices are listed before
homebrew choices. The Workshop's unresolved class spell list also supports
replacement without separately removing and adding entries.

A missing legacy reference containing an explicit readable spell key can display
the corresponding SRD definition, labelled as a fallback. Missing hashes cannot
identify a spell, so they require an explicit replacement. Existing valid
homebrew definitions remain authoritative.

Imported placeholders without rules text can also display an SRD fallback when
their recorded name uniquely matches an SRD spell. Incomplete placeholders are
excluded from replacement targets. Original valid homebrew definitions are kept.

## Progressive opening and DM player preview

The opening GET uses `?view=quick` after the same owner/membership/assignment
checks as a resolved sheet. It returns saved character rules, normalised item
profiles, automatic resources, and local standard spell definitions. This path
does not query the Orcbrew library. The scoped reference response carries a
fully resolved character, applied in the background only when the character,
saved version, view scope and play-mutation counter still match. An open editor
is kept intact and pending rules are flagged. Regular room refreshes use the quick
path plus a small library revision marker; changes to either the saved character
or the pack revisions trigger fresh resolved references. All real writes still
use the server's latest resolved rules.

Quick reads time out at 12 seconds with an explicit retry. Reference refreshes
time out separately at 20 seconds; switching characters cancels obsolete
reference reads. Duplicate current-sheet reads coalesce. Database connection,
socket and pool waits are bounded. Timed-out writes are never replayed by the
frontend. No private sheet is placed in persistent/browser/public caches.

Loading status reports saved-sheet and reference timing separately. Backend
Server-Timing headers and sampled/slow log entries record application/database
read time without character content or account identifiers. These measurements
do not include gateway cold-start time before the application begins handling
the request. Raw pack reads use version-checked pieces of at most 192K code points,
with at most four piece requests in flight, instead of one large database reply.
Unicode boundaries, ownership, update timestamps and source hashes are preserved.
The database connection negotiates zlib transport compression. Creation, workshop, compendium and sheet routes load separately to
reduce initial app download and parsing.

The DM-only Player view switch presents the selected character with player
permissions and the appropriate assigned-character roster. HP, resource,
prepared-spell and equipment controls work locally in preview. No play or
permanent write is submitted; leaving preview fetches the saved sheet again.
Temporary preview changes cannot be overwritten by background rule hydration.
Actual players retain their normal live play controls and assignment checks.

### Live observations on 2026-10-19

The slow path produced MongoNetworkTimeoutError during large source-document
reads; revision checks were about 13–26 ms. Bounded piece reads completed
successfully, with the two-pack source read taking about 12.7 seconds and complete
assembly about 14.2 seconds on first use. Saved-sheet opening measurements in the
room were 0.60 and 0.78 seconds; full reference checks were 15.31 and 15.78 seconds.
These are individual measurements, not latency guarantees or full-page startup
timings. The important distinction is that the saved sheet is usable while the
reference check finishes. Later room refreshes use the quick path and revision
marker rather than repeatedly blocking on the full library.

Player preview was exercised with a local HP change from 96 to 95; exiting
preview fetched the saved 96 HP. Ten targeted checks cover temporary writes,
late responses, preserved edits, duplicate reads, quick snapshots, pack revision
markers, Unicode boundaries and a pack changing during reconstruction.

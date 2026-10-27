# Events release and approved campaign entries

Live deployment: `dpl_8db5ZLPuVn8vnDSDmECewJJMHaFr` — https://dndoldal-41ju22h0z-dndenjoyerstudio.vercel.app

Public site: https://dndoldal.vercel.app

Previous production: `dpl_EJqvJJsE3z8vV4ygSPxdNoYdDoqB` — https://dndoldal-k2hnq1f6k-dndenjoyerstudio.vercel.app

## Behaviour

Events lists standalone events and entries explicitly marked Also list in Events. A quest can appear in both Events and Quests while retaining one entry ID, body, clues, status, revision history, audience and connections. Its Events overview shows the current gathered clues; the Clues tab remains available. Updating a clue from either view updates the same entry. Finished quests remain listed in Events.

The DM controls Events classification. No existing entries were automatically reclassified. Permissions apply before list counts, filtering, pagination and clue search. Events membership never reveals a private entry or clue. The library's unique total does not double-count entries appearing in two categories. Legacy edits and text restoration preserve the current Events listing.

## Release preservation and verification

Two concurrent production promotions were caught by the release guards. The final candidate was rebased onto the saving-recovery deployment above, preserving that recovery, contextual editing, private quest preparation, Maps and Party work. Exactly six production source files changed. All 311 staged file hashes matched the audited baseline plus the Events changes. No commit or push was made; unrelated root edits were excluded.

The isolated frontend build and backend typecheck passed. All 41 focused shared/API tests and 14 disposable preview-model tests passed. Browser verification edited a shared clue from Events, read the updated clue in Quests, and checked that player views omitted private clues and management actions. A 390px iframe displayed the updated overview without horizontal overflow (379px client and scroll width), with document scroll at zero. Native screenshot/snapshot calls timed out, so browser verification used DOM content, form interaction and geometry.

The protected staged hostname returned a login HTML response to unauthenticated health checks; it was not counted as application health verification. After promotion, the public alias resolved to the expected READY deployment, `/api/health` returned JSON 200 and unauthenticated notebook access returned 401. Authenticated Events listing and the live Events interface worked. Before campaign edits, sequential reads of all 50 entries and folders exactly matched the before-release snapshot after excluding the additive Events metadata.

## Approved campaign writes

The current saving recovery was preserved. Actual approved writes then succeeded without retries:

- Ashton Hollowborne (`6ada2d12e3524bc85c4c2223`): revision 2; current whereabouts now say he travels with the core team. The Session 12 line retains his auction absence without a present-tense claim that his whereabouts are unknown. HTTP 200 and readback matched both changes; DM-only sharing retained.
- Kirros (`6adb1e62f7745de232f71e63`): new DM-only person, revision 1, with the approved description and monastery/Session 11 connections. HTTP 201 and readback verified.
- Whispering Tressym — Suttogó Tressym (`6adb1e62f7745de232f71e65`): new DM-only faction, revision 1, with Cagliostro/Truuselar/Session 10 connections. HTTP 201 and readback verified.
- Az Ősi Elemek Könyveinek elrablása (`6adb1e63f7745de232f71e67`): new active quest, revision 1, listed in both Events and Quests. It uses the current DM-only preparation default and connects to Amdurun, the Ancient Elements books and Session 12. No clues were invented or added. HTTP 201 and readback verified.

The final notebook contains 53 unique entries. The same book-theft entry ID appears in Events and Quests; its live overview shows Gathered clues with zero recorded clues. Fade and Volenta previews exclude the private quest from both tabs and return 404 for direct access. The existing public Bill Clinton quest remains readable and unchanged.

A final sequential read of all 53 entries found exactly the three approved additions and Ashton's approved stored-content change. The other 49 original entries retain their stored fields, body and cover-image hashes, revisions, sharing, outgoing connections, tags, quest status and clues. New incoming connections are derived from the approved additions and do not modify their target entries. Local approval files now record saved IDs and verified status. No monitoring task was enabled.

Evidence: `.preview.local/notebook-events-release-20261023-r3/` and `.preview.local/notebook-entry-review-20261023/`.

## Rollback

Promote the previous saving-recovery deployment with the authenticated Vercel CLI. This changes code only; campaign entries and the Events metadata remain in storage. The prior UI will still show the book-theft entry as a quest, while its Events flag will remain stored for a later Events release. Do not restore pre-save snapshots over the approved campaign edits.

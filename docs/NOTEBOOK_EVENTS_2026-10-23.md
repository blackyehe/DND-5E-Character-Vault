# Events and shared quest entries

The user requested an Events tab, entries accessible through both Events and Quests, and the latest gathered clues visible in the event view.

An entry retains one primary category and can additionally be listed in Events. The explicit `showInEvents` boolean does not create another document. A standalone event uses `codexType: events`; a quest listed in both retains `codexType: quests`, status, clues, ID, revision history, sharing and connections. The DM controls Events classification. Existing entries remain unclassified unless individually approved.

The Events list includes standalone events and explicitly marked entries, including finished quests. The quest's Events overview renders its current gathered clues, using the same component and clue data as the Clues tab. Both views edit the same entry. The normal reader refresh picks up later saved revisions.

Permissions apply before category filters, counts and pagination. Private quests, clues and ancestor-hidden entries remain private. Events membership never grants access or changes audience. A separate unique entry count prevents entries listed in both categories from inflating the library total. Legacy clients preserve the Events flag when omitting it; restoring text preserves current category, flag, clues and sharing.

Implementation modifies six production files: shared notebook contracts and category helpers, the Notebook model, notebook routes, CampaignNotebook and NotebookConnections. It adds the Events category and the DM's Also list in Events editor control. No schema migration or automatic campaign reclassification is needed.

Validation: 41 focused shared/API tests and 14 disposable preview-model tests pass; frontend build and backend typecheck pass. Local browser verification edits a shared clue from Events, reads the updated clue from Quests, and verifies that the player view excludes private clues and management actions. A 390px iframe shows the updated clue overview with no horizontal document overflow (379px client and scroll width) and document scroll at zero. Native screenshot/snapshot automation timed out; browser checks used DOM content, form interaction and geometry.

Release preparation reconstructs the current production source and audits every file hash. Two concurrent promotions were detected and reconciled before Events promotion, preserving contextual editing, quest visibility and the notebook saving initialization recovery. The final candidate is under `.preview.local/notebook-events-release-20261023-r3/`; earlier candidates were not promoted to the public alias. Release results and campaign content verification will be documented separately.

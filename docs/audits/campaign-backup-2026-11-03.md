# Complete campaign backup and restore — 3 November 2026

Published and publicly verified at https://dndoldal.vercel.app as `dpl_9E2f9tBXXfZVGbiWPediwLufEpnt`, promoted on 3 November 2026. The final release contains the verified eight-file runtime scope. Hosted source audit, real download, public backup decoding, existing API contracts and desktop/mobile regression checks passed. Previous deployment: `dpl_YNitYq56a73VDeBKNy5j5G1cDiHC`.

The new version 2 backup includes characters, libraries, character folders, owned rooms, Notebook entries/folders and full saved history, Maps with original/overview images, pins and regions, city libraries including undo state, and all supported device draft types. Saved recovery/trash data and item/action revision numbers are retained. Only rooms owned by the authenticated account are exported; joining another DM's campaign does not authorize backing up that campaign's private records.

## Format and restore behavior

The server reads all included collections through one MongoDB snapshot transaction. It backs up stored character data directly, avoiding rule reconstruction while exporting. The versioned JSON file contains a compressed BSON-aware payload, its expanded byte count, a SHA-256 checksum and a readable count manifest. Device drafts and appearance settings are added by the browser. This is compression and integrity checking, not encryption.

Restore validates the checksum, bounded expansion, record graph, image contents, model fields and storage quotas before completing an atomic database transaction. It requires an account with no existing saved characters, libraries, owned campaigns or nonempty character folders. Existing data is never replaced. New document IDs permit restoration into another account while the source account still exists; internal subdocument IDs stay stable. References, legacy pack/item identities, wiki links and note links are updated together. Source-file bytes, image bytes, dates, history versions and saved item/action revisions are preserved. Derived Notebook summaries and Map storage ledgers are rebuilt.

Restored rooms belong to the destination account, start with no members or assignments and receive new invitation links. Players must rejoin and be reassigned. Entry and Map audience restrictions remain intact; restoring a file does not automatically authorize existing accounts. History author labels remain part of the saved record.

All six supported device fields are captured from both Workshop backup controls: class/race drafts, option drafts, monster drafts, deleted drafts, the character draft and appearance settings. Imports restore these through the Dashboard. Existing local drafts/settings win on conflicts; old deleted-draft storage locations are rewritten to the current account's allowed keys. A device storage failure is reported separately from a completed server restore, and the backup file remains available for recovery.

Version 1 library backups remain supported. Their existing identity/collision behavior is retained. Version 2 archive expansion is bounded to 256 MiB; complete files including device data are limited to 50 MiB, matching the existing authenticated chunked-upload path. Exports exceeding these limits fail explicitly rather than download a partial archive. The backup contains owned campaigns, not campaigns owned by another account.

## Validation

- 251 candidate tests passed; two optional external-pack tests skipped. Production frontend build and frontend/backend types passed.
- A fresh loopback replica-set fixture passed 84 recorded API requests plus an actual built-browser import/download workflow. It covers large-file chunking, duplicate/stale folder placements, preserved subdocument IDs and item revisions, private/deleted notes, history, wiki links, public/private map pins, region/image data, city links and hidden categories, device draft references, old backups, concurrent restores and occupied-account rejection.
- Corrupted archives, missing image assets, cross-campaign references and Map quota exhaustion reject without partial records, character folders or quota allocations.
- A read-only hosted export of the actual account contained six characters, 132 library records, one owned room, 122 Notebook records, 307 history records, one Map and four character folders. Its JSON archive was approximately 22.6 MB; an actual browser download also passed. These counts describe that snapshot, not a permanent account size.
- That actual archive was restored into a fresh local replica set. Original source/image bytes and the original stored fields, note/history links, dates and folder relationships were compared after accounting for the deliberately new IDs, private room membership and rebuilt derived metadata. The rehearsal passed. No production restore was attempted.
- All fixture databases were dropped, processes stopped and browser contexts closed. Private archives remain under the ignored `.local/campaign-backup-20261103/` evidence directory and must not be committed or shared.

The isolated release source starts from `dpl_YNitYq56a73VDeBKNy5j5G1cDiHC`; eight runtime files and two test files are allowlisted, totaling 482 source/test inputs. Other dirty local changes are excluded. One staged candidate was superseded before promotion to preserve legacy folder placements for already deleted characters. The final source, real-data rehearsal, cleanups and release gates are recorded under `.local/campaign-backup-20261103/`. No schema/index migration or production restore was required. Earlier backup versions remain importable; rollback to the previous application would remove version 2 import support until this code is restored, so keep new archive files.

## Use

Open Homebrew Workshop and choose **Download site backup**. Keep the resulting `codex-of-heroes-backup.json` file. To restore, sign into an empty account and use **Import JSON / backup** on the Dashboard. Review the counts and the fresh-invitation notice before confirming. Existing device drafts are preserved on conflict.

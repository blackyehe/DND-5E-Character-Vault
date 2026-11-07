# Site audit fixes — release verification, 3 November 2026

The three verified audit fixes are live at https://dndoldal.vercel.app.

- Deployment: `dpl_YNitYq56a73VDeBKNy5j5G1cDiHC`.
- Previous deployment: `dpl_E391jrT92GzvU6H7Vqdm5vV7jV1A`.
- Immutable URL: https://dndoldal-kjmh2n2ey-dndenjoyerstudio.vercel.app.

## Released behavior

1. Non-DM Notebook requests require an active entry. Deleted entries no longer return text, history, conditional read validation or player recovery by a known ID. The DM can still inspect trash and recover an entry.
2. Unknown authenticated site addresses render an explanation and a return link. Protected-route login redirection remains intact.
3. Login/registration inputs have associated labels and suitable autocomplete attributes.

Four runtime files and two regression-test files differ from the exact previous release. All 477 hosted source/test files were verified by hash, with an explicit change allowlist. Deployment environment variable names and the Frankfurt region were also checked against the previous release. The existing Notebook reader allowlist and pack-preparation settings were retained. No schema, index, migration or campaign data change was required.

## Verification

- Fresh complete candidate suite: 244 tests passed; two optional external-pack tests skipped.
- Production build and frontend/backend type checks passed.
- The prior isolated HTTP audit passed 148 requests against this exact candidate; its temporary database and process were cleaned up.
- Hosted and public responses matched the previous release for characters, room identity, Creator selections, Notebook listing/sessions/links, Workshop startup and Maps. The real room continued using the indexed Notebook reader.
- Hosted and public browser checks passed login/registration labels, protected-route redirection, unknown-route recovery and Dashboard opening at 1280- and 390-pixel widths, plus Compendium browsing/detail reading.
- Browser contexts recorded zero data mutation requests and zero uncaught errors, and were closed after checking.

There was no suitable currently deleted, whole-room note in the real account for a fresh hosted privacy reproduction. That regression was reproduced against the previous source and verified against the candidate through both route tests and an isolated real Express/MongoDB fixture. No real note was created or deleted for verification.

The public alias was changed only after hosted gates passed, then checked again through both API and browser workflows. Evidence and guarded release/rollback helpers are in `.local/full-site-audit-20261103/`, including `final-release-gates.json`. Rolling back to the previous deployment would also restore its deleted-entry access defect; use the rollback helper only for an actual release failure.

The audit's campaign-backup coverage gap and cold/full-navigation delivery delays remain open. This release makes no new latency improvement claim. Broader unrelated local changes remain unpublished.

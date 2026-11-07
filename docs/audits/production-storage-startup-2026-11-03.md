# Remove repeated storage setup from production starts

This addresses a bounded source of startup work within the intermittent-wait investigation. It does not perform the broader Notebook migration or claim that every historical multi-second stall is solved.

## Finding and change

The published app registers 21 Mongoose models. Connecting a fresh process with the default production configuration automatically sends 16 collection-creation and 23 index-creation commands, even against a database already prepared by an earlier process. Existing indexes are not rebuilt when specifications match, but the commands and initialization work are still repeated. Separate serverless processes can repeat that work independently alongside first user requests.

The isolated runtime change adds `autoCreate:false` and `autoIndex:false` to production connections in `server/db.ts`. Development and test environments retain automatic setup. Connection pooling, retry behavior, query authorization, source schemas, index definitions, writers and client code are unchanged. Production deployments must explicitly prepare any new collection or index before releasing schema changes. [Mongoose documents these production options](https://mongoosejs.com/docs/guide.html#autoIndex).

This removes a demonstrated workload. It is not proof that those commands caused the observed Free-tier delays or that throughput limits were exceeded. Current production logs also show connection readiness and room/character/folder command latency; those are not eliminated by changing schema setup defaults.

## Checks

- A raw-driver, read-only production audit loaded the exact published model definitions without connecting Mongoose. All 21 model collections exist; the 16 automatically managed collections have every expected index with matching keys and relevant unique/sparse/TTL/partial/collation settings. Only list-collections/list-indexes commands and session cleanup were issued.
- Fresh isolated MongoDB replica-set rehearsal: bootstrap the unchanged published schema; start a second unchanged process against it; start the actual candidate in production mode against the same prepared database. Candidate startup issued no create/create-index commands. This checks actual driver activity, not just connection option values.
- Candidate HTTP lifecycle passed account registration, duplicate-user unique-index enforcement, room creation, transactional Notebook creation/edit, listing, detail and two-version history. No collection/index setup commands occurred during those writes either. The fixture database was removed; its process exited and its port was independently confirmed closed.
- Four connection unit tests passed: production setup disabled, development setup retained, simultaneous connection reuse, and recovery after a failed connection. The isolated candidate's backend TypeScript passed. Client files are byte-identical to the prior published release.

## Release boundary

**Live at 11:06 UTC on 3 November 2026:** `dpl_E2wknEHLtZjUMSZKeSZAPrgV6nvE`, https://dndoldal.vercel.app (immutable URL: https://dndoldal-wqzosnnwh-dndenjoyerstudio.vercel.app). The isolated package derives from `dpl_7XgQUB7b5CmhyXAZTcuEyVSKkTb6`: one runtime file and one new test, 461 source files total. The mixed root checkout was not deployed. Hosted source matches the frozen manifest exactly. Five authenticated response pairs match the previous release, and anonymous Notebook access returns 401; those checks passed on both the staged and public URLs. Synthetic imported/native pack publication, revision invalidation and exact export checks passed and their temporary packs were cleaned. The first promotion confirmation ran before alias propagation completed; a subsequent read confirmed the intended deployment and public checks passed. This was confirmation timing, not an application failure.

The prior startup deployment is the rollback target. The task-owned release helper's `rollback` command checks that this deployment is still current and promotes that previous deployment. No Git commit/push was made. Finite healthy read observations are not a controlled cold-start before/after performance study.

No production backfill, certification, index build, hosting-tier upgrade or Notebook reader enablement is included. The production application database stays on the existing schema and reader. Future schema releases must repeat storage readiness verification and deliberately provision their storage; disabling automatic setup makes that a release prerequisite.

Evidence is in `.local/notebook-wait-20261103/`: startup probes, storage audit, synthetic lifecycle/cleanup, connection tests/types, source manifest and hosted release checks. Private connection strings remain in the private credential delivery location and are not copied into evidence.

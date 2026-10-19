# Public rooms and hosting

## Approved setup

- Vercel Hobby, project `dndenjoyerstudio/dndoldal`, frontend and Express backend in one Services deployment. Services is currently a Vercel beta available on Hobby.
- MongoDB Atlas Free, in a dedicated Atlas project. The app database is `dnd_site`; the app user receives `readWrite` on that database only.
- Atlas must accept connections from any IP for Vercel's dynamic egress. This was explicitly approved. TLS and strong database credentials remain required. Do not use the standard integration's `readWriteAnyDatabase` account for this app.
- A new public DM account will be registered. Existing local passwords and demo accounts are not migrated.

## Room behaviour

1. Sign in and open **Game rooms**.
2. Create a named private room.
3. Use **Invite players** to copy its persistent joining link. Links stay valid until the DM replaces them; replacing a link does not remove members.
4. Players register or log in, then explicitly join. Joining grants no character access by itself.
5. The DM assigns an owned character to a joined player using the roster dropdown. The player receives the complete sheet, including Spells, Equipment, and Features.
6. Assigned players can change current/temp HP, death saves, inspiration, used hit dice, spent spell slots and resources, prepared spells already on the character, equipped items and quantities, and feature display pin/order. Permanent character choices, rule maxima, ownership, imports, exports, and Workshop publishing remain under the owner's account.
7. Removing a member also removes their assignments. They can rejoin through the current link but do not regain assignments automatically.

Character reads, references, and play writes check membership, assignment, and ownership on the server. Players do not receive the owner's raw DMV import. Owner homebrew references needed by the assigned character are supplied through the authorised room route. Room updates refresh every 15 seconds while visible and on focus. Stale resource actions are rejected rather than merged over newer state.

## Deployment prerequisites

- Vercel CLI authentication and the exact project link must be verified before mutations.
- Required production settings: `MONGO_URI` (or `MONGODB_URI`) and a unique `JWT_SECRET` of at least 32 characters. Alternatively, supply `MONGO_HOST`, `MONGO_USER`, `MONGO_DATABASE`, and secret `MONGO_PASSWORD`; the server encodes credentials and constructs the URI without displaying it. Production refuses development defaults.
- Optional `APP_ORIGIN` is a comma-separated list of trusted external website origins when the API sees a different host. Never use a wildcard.
- Production SRD references default to `https://www.dnd5eapi.co/api/2014`; local development defaults to the Docker SRD service. `SRD_API_URL` overrides this.
- The linked project uses Node 24.x. Local Node 26 remains usable with the repository's existing engine range.
- `.env*`, `.vercel`, backups, and tooling scripts are excluded from deployment. Secrets must not be committed, printed, or pasted into chat.
- The SPA has a deep-link fallback. `/api` is routed to Express before the frontend catch-all.
- Large JSON requests use authenticated temporary database chunks; large responses are streamed. The 8 MB Orcbrew source limit remains enforced after reconstruction. Temporary upload documents expire after 15 minutes.

## Moving existing content

The source account currently has six characters and two content entries. A content backup exists under the ignored `backups/` directory; it includes original pack sources and character play state, not user passwords. After registering the new public DM account, use Dashboard → Import JSON / backup to restore that file. This uses the account's authenticated backend connection and does not need to expose its database secret locally. Complete native Workshop backups are accepted by the same importer.

To create another backup from the `server` directory:

```powershell
node --import tsx scripts/backup-local.ts <local-owner-email>
```

After the public DM account exists, set `TARGET_MONGO_URI` securely for that process, then run from `server`:

```powershell
node --import tsx scripts/migrate-content.ts <absolute-backup-path> <new-public-dm-email>
```

Both migration paths preserve character and pack IDs so imported references remain stable, map their owner to the new account, leave the local database intact, and refuse non-empty destination accounts or ID collisions. Both collections are written in one Atlas transaction. Do not pass a connection string or password on the command line. Transactional library restore requires Atlas or another replica set, rather than a standalone development MongoDB.

## Current checkpoint

- Frontend production build and server typecheck pass; no tests were added or run.
- Project linked and content backup saved.
- Atlas Free `codex-heroes` was created in Frankfurt in the dedicated `Codex of Heroes` project. The `codex_app` account has `readWrite @ dnd_site`, scoped to that cluster only. The approved `0.0.0.0/0` network rule is saved.
- Required production secrets and the non-secret host/user/database settings are saved in Vercel. The user entered the database password directly into Vercel; no password was displayed in chat or logs.
- Production is live at https://dndoldal.vercel.app. The user registered the new DM account Blackyehe and the authenticated dashboard confirmed restoration of six characters and two content entries. The local originals and backup remain intact.
- No synthetic players, assignments, or resource changes were made for testing. The Game rooms interface is ready for the user to create and name the first room.

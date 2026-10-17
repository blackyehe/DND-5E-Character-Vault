# Plan: D&D 5E Character Sheet Site

## Goal

A site for building and storing multiple D&D 5E character sheets, with full login
accounts, SRD content pickers (races, classes, spells, equipment), auto-calculated
stats, and support for custom/homebrew content later. UI language: English.

**Rules scope**: first release supports **2014 rules only** (the upstream API's
`/api/2014` routes). The upstream 2024 routes exist but are out of scope.

**Custom content scope (first release)**: backgrounds, feats, and custom spells.
Custom races/classes/subclasses are deferred (complex API shapes; the pickers
work fine against SRD-only races/classes).

## Toolchain

- **Node: pin 24 LTS** via `.nvmrc` (contents: `24`) + `"engines": { "node": ">=20.19" }`
  in `package.json`. Rationale: Vite 8 requires `^20.19.0 || >=22.12.0`; the
  planning environment reported Node 20.15.0, which **fails that requirement**.
  Step 0 of implementation: install/switch to Node 24 (e.g. `nvm install` /
  `nvm use`, or update the system install) and confirm `node -v` >= 22.12 before
  touching dependencies. `server/` targets the same version.
- pnpm is **not** required for this project (npm is fine); the SRD API runs
  entirely inside Docker and brings its own pnpm.

## Architecture

| Service | Tech | Port | How it runs |
|---|---|---|---|
| Frontend | Vue 3 + TS + Vite + Tailwind v4, vue-router, Pinia | 5173 | `npm run dev` (existing scaffold) |
| Own API | Express 5 + TypeScript + Mongoose + zod | 4000 | `server/` via `tsx watch` |
| SRD API | `ghcr.io/5e-bits/5e-srd-api:v5.11.0` (pinned; `latest` avoided) | 3000 | root `docker-compose.yml` |
| MongoDB | `ghcr.io/5e-bits/5e-database:v4.7.0` (pinned; pre-seeded SRD) | 27017 | root `docker-compose.yml` |
| Redis | `redis:6.2.5` (SRD API requires it for caching) | 6379 | root `docker-compose.yml` |

Image tags verified to exist on GHCR (manifest HTTP 200, checked during the
plan audit). Both pinned images track the upstream git tags `v5.11.0` /
`v4.7.0`.

### docker-compose.yml (specified, not yet written)

```yaml
services:
  db:
    image: ghcr.io/5e-bits/5e-database:v4.7.0
    ports: ['27017:27017']
    volumes: [mongo-data:/data/db2]     # dbpath per the image's mongodb.conf
    healthcheck:
      test: ['CMD', 'curl', '--connect-timeout', '10', '--silent', '--fail', 'http://localhost:27017']
      interval: 5s

  cache:
    image: redis:6.2.5
    ports: ['6379:6379']
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s

  srd-api:
    image: ghcr.io/5e-bits/5e-srd-api:v5.11.0
    ports: ['3000:3000']
    environment:
      MONGODB_URI: mongodb://db/5e-database   # image default points at localhost and would fail
      REDIS_URL: redis://cache:6379           # same
      NODE_ENV: development                   # REQUIRED: image bakes NODE_ENV=production and
                                              # httpsRedirect 301s plain HTTP to HTTPS, which
                                              # would break http://localhost:3000 locally
    depends_on:
      db: { condition: service_healthy }
      cache: { condition: service_healthy }

volumes:
  mongo-data:                                 # explicit named volume; Docker copies the
                                              # image's baked-in seed into it on first mount
```

- Vite dev proxy: `/api/2014` -> `:3000` (SRD), `/api` -> `:4000` (own API).
  Same-origin keeps auth cookies simple. Own API must not register routes under
  `/api/2014`.
- SRD API has CORS wide open; HTTPS redirect is neutralized by the
  `NODE_ENV=development` override above.
- SRD data is seeded into the Mongo image **at build time** under `/data/db2`,
  which is a Docker VOLUME. The named volume `mongo-data` receives that seed on
  first mount; data (including homebrew inserts) survives `docker compose
  down && up`. **`docker compose down -v` deletes the volume and wipes the
  database** — always re-verify the seed after a `-v` teardown.

**Homebrew/custom data (go/no-go gate in step 1)**: same Mongo instance, own DB
(`dnd_site`) for users/characters/custom content. First-release custom content
types: **backgrounds, feats, custom spells**. Inserting custom docs into the SRD
collections of `5e-database` would get them served by the official API for free
— this is a **go/no-go check in step 1**: insert a test spell, confirm
`GET /api/2014/spells/<index>` returns it (check both list and detail routes).
If it fails (schema filtering, caching, etc.), fall back to merged
list-endpoints on our own API (`/api/content/:type` = SRD + custom) **before**
building the content pickers around either path.

### Go/no-go result (verified 2026-10-17): **GO**

- The seeded database prefixes all collections by rules version (`2014-spells`,
  `2024-spells`, `2014-classes`, …). There is **no** bare `spells` collection —
  the API maps `/api/2014/spells` to the `2014-spells` collection.
- Inserted a test spell doc into `5e-database`.`2014-spells` via `mongosh` in the
  `db` container, flushed Redis and restarted `srd-api` so nothing was served from
  cache. Both routes returned **200**:
  - `GET /api/2014/spells/zz-test-homebrew-spell` (detail)
  - `GET /api/2014/spells?name=Zz%20Test` (list, `count: 1`)
- **Decision: custom spells are inserted directly into the SRD `2014-spells`
  collection** and served by the official API for free. No merged-endpoint
  fallback is required for spells.
- **Caveat for the content system**: because list responses are served from
  Redis and the SRD API prewarms its cache on every container start, a freshly
  inserted custom spell may not appear in *cached list* responses until the
  `srd-api` container is restarted (or its Redis keys flushed). Detail routes
  resolve per-request and are not affected. The already-built content routes
  (`/api/content/spells` on our own API, `dnd_site`.`customcontents`) remain a
  valid store for custom spells; sync them into `2014-spells` when the user
  wants them SRD-served, or keep them app-side — both paths are viable.
- **Backgrounds/feats DO have SRD API routes** (`GET /api/2014/backgrounds`,
  `/api/2014/feats`), but coverage is thin (1 each in the seed: "Acolyte" and
  "Grappler"). Our own `/api/content/:type` custom-content store complements
  these; the pickers should merge SRD + custom for backgrounds/feats rather than
  assume one source. (Earlier plan text saying the API "has no" backgrounds/feats
  endpoints was inaccurate — corrected here.)
- The test spell was deleted and Redis flushed after verification.

## Repo layout

```
dndoldal/
├─ docker-compose.yml        # db + cache + srd-api (official images)
├─ PLAN.md
├─ src/                      # Vue app (existing)
│  ├─ lib/calc.ts            # all derived-stat math (unit-tested)
│  ├─ lib/srd.ts             # typed SRD API client + index types
│  ├─ stores/auth.ts, characters.ts
│  ├─ router/
│  ├─ views/  Login, Dashboard, CharacterSheet, Compendium
│  └─ components/sheet/, components/pickers/, components/ui/
└─ server/
   ├─ index.ts, env.ts
   ├─ models/User.ts, Character.ts, CustomContent.ts
   ├─ routes/auth.ts, characters.ts, content.ts
   └─ seed/backgrounds.ts    # built-in SRD backgrounds (API has none)
```

## Backend (server/)

- **Auth**: register/login/logout/me, bcryptjs hashing, JWT in httpOnly cookie
  (7d), zod validation, `requireAuth` middleware. Characters scoped to `userId`.
- **Character document** (flexible Mongoose schema):
  - `meta` (name/race/class/subclass/background/level/alignment/xp/portrait)
  - `abilities` (str/dex/con/int/wis/cha scores)
  - `saves` (per-ability proficiency flags)
  - `skills` (none/prof/expert per SRD skill index)
  - `combat` (AC, HP, temp HP, hit dice, death saves, speed, inspiration)
  - `attacks[]` (name, ability, range, damage dice/bonus/type, notes, magic)
  - `equipment[]` (+ coins, weight, equipped, qty)
  - `spellcasting` (ability, slots 1-9 with used, prepared/known spells with
    SRD indexes)
  - `personality` (traits/ideals/bonds/flaws/appearance/backstory/notes)
  - `features[]`, `proficiencies` (armor/weapons/tools/languages)
- **Endpoints**:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET  /api/auth/me`
  - `GET  /api/characters` (list; summary fields only)
  - `POST /api/characters` (create)
  - `GET  /api/characters/:id`
  - `PATCH /api/characters/:id`
  - `DELETE /api/characters/:id`
  - `POST /api/characters/:id/duplicate`
  - `GET  /api/characters/:id/export` (JSON download)
  - `POST /api/characters/import` (JSON upload)
  - `GET  /api/content/:type` (type = backgrounds | feats | spells; merged
    SRD + custom, or custom-only depending on the step-1 go/no-go outcome)
  - `POST /api/content/:type`
  - `PUT  /api/content/:type/:id`
  - `DELETE /api/content/:type/:id`
  - Registered custom spells are inserted into (or merged over) the SRD
    `spells` collection per the step-1 decision; backgrounds/feats live only in
    our `dnd_site` DB (the SRD API has no endpoints for them).
- Stack pinned to known-good: express@5, mongoose@9, zod, jsonwebtoken,
  bcryptjs, tsx (dev), typescript.

## Frontend

**Routes**: `/login`, `/` (dashboard), `/characters/:id` (sheet), `/compendium`.

**Dashboard**: character cards (portrait, name, class/level, race, updated),
create-from-template, duplicate, delete, export/import JSON.

**Create wizard** (modal): name -> race/subrace picker -> class picker -> level
-> background picker -> ability method (point buy / standard array / manual)
-> auto-fill defaults (max HP at level, class save proficiencies, speed, hit
dice).

**Sheet** — tabbed, sticky header (name, class/level, AC, HP, initiative, speed,
prof bonus), inspired by the Dungeon Master's Vault layout:

1. **Core** — 6 ability boxes with auto modifiers, saving throws, 18 skills with
   prof/expert toggles, passive perception, inspiration, proficiencies &
   languages
2. **Combat** — AC, HP/temp HP, hit dice, death saves, initiative, speed,
   attacks table (to-hit = ability + prof + magic, auto from equipment)
3. **Equipment & Spells** — inventory w/ qty/weight/equipped + coin pouch,
   "add as attack" action; spellcasting ability, auto spell attack/DC, slot
   tracker, prepared toggle, spells grouped by level, picked from SRD with
   detail popups
4. **Bio & Notes** — traits, ideals, bonds, flaws, appearance, backstory,
   features/traits list, free notes

**Calculators** (`lib/calc.ts`): ability mod, prof bonus `2+floor((lvl-1)/4)`,
skill/save mods, HP max (`max die + con` at 1st, avg after), initiative, passive
perception, spell attack/DC, attack bonus/damage, carried weight. Manual
overrides win where rules allow.

**SRD pickers & Compendium**: searchable modal (race, class, subclass, skill,
equipment, spells) + read-only compendium browser (spells/equipment/classes/
races/monsters) with detail views, all from `/api/2014`.

## Implementation order

0. **Toolchain**: install/switch to Node 24 (`node -v` must be >= 22.12 before
   any dependency work); add `.nvmrc` = `24` and `engines` to `package.json`.
1. **Infra + go/no-go**: make the initial git commit (repo is initialized but
   has **zero commits** — everything is still untracked); write the pinned root
   `docker-compose.yml` (above); start Docker Desktop; `docker compose up -d`
   (first run pulls the images); verify `GET http://localhost:3000/api/2014`
   responds; then the homebrew go/no-go check: insert a test spell doc into the
   `spells` collection (via `mongosh` in the `db` container) and confirm the
   SRD API serves it on both the list and detail routes. Record the outcome in
   PLAN.md; the content system (step 3/9) is built on whichever path wins.
2. Install `tailwindcss @tailwindcss/vite` (4.3.3 supports Vite 8),
   `vue-router`, `pinia`; rebuild `style.css` as Tailwind entry + theme tokens +
   app shell/layout
3. Build `server/` (auth -> characters CRUD -> content) with
   `npm run server:dev` script; typecheck
4. Frontend auth flow (login/register, auth store, route guards)
5. Dashboard (list/create/duplicate/delete/export/import)
6. `lib/calc.ts` + vitest unit tests for all derived math
7. Sheet: Core + Combat tabs, then Equipment/Attacks, then Spells, then Bio
8. SRD pickers + create wizard
9. Compendium browser + custom content UI (homebrew editor) — built on the
   step-1 integration path
10. Polish: error toasts, empty states, print stylesheet; final
    `npm run build` (vue-tsc) + `tsc --noEmit` on server

## Implementation status (2026-10-17)

- **Steps 0, 2–10 are DONE.** Toolchain (Node 24 pin, engines), Tailwind v4 + app
  shell, `server/` (auth → characters CRUD → content), frontend auth flow +
  guards, dashboard, `lib/calc.ts` + 12 passing vitest tests, all four sheet
  tabs (Core/Combat/Equipment & Spells/Bio), SRD pickers + create-wizard
  scaffolding, and the Compendium browser are all built and verified.
- **Verification**: `npm run build` (vue-tsc -b + vite build) passes;
  `npm run server:typecheck` (tsc --noEmit) passes; `npx vitest run` → 12/12.
- **Step 1 is BLOCKED on Docker Desktop**, which was not running. The pinned
  `docker-compose.yml` is written but the stack has never been started, so the
  `/api/2014` reachability check and the homebrew go/no-go gate are still
  pending. Start Docker Desktop, then `docker compose up -d` and run the two
  step-1 checks below.

## Step 1 remaining checks (once Docker is up)

1. `docker compose up -d` (pulls `srd-api`, `db`, `cache`).
2. `GET http://localhost:3000/api/2014` responds.
3. **Homebrew go/no-go**: insert a test spell into the `spells` collection via
   `mongosh` in the `db` container; confirm `GET /api/2014/spells/<index>`
   returns it on both the list and detail routes. Record the outcome here — the
   content system (already built against merged/custom endpoints on our own API)
   can switch to SRD-collection insertion if the gate passes.

## Verification

- `npm run build` (vue-tsc -b + vite build) must pass; `tsc --noEmit` in
  `server/`; `npx vitest run` for calc tests
- Manual: compose up -> register -> create character -> all tabs -> reload
  persistence -> export/import

## Risks / notes

- **Node version**: planning environment had Node 20.15.0, which Vite 8 rejects.
  Step 0 (pin 24 via `.nvmrc`/`engines`) is a hard prerequisite for installing
  any dependencies.
- **Docker Desktop must be started** (daemon was down during planning) — first
  run pulls 3 images (`srd-api`, `db`, `cache`).
- **`NODE_ENV=production` is baked into the SRD API image** (confirmed in the
  v5.11.0 Dockerfile) and its `httpsRedirect` middleware 301s plain HTTP to
  HTTPS — the compose **must** override `NODE_ENV=development` or
  `http://localhost:3000` breaks.
- **`docker compose down -v` wipes `mongo-data`**, including the SRD seed and
  any homebrew inserts; re-verify the seed after any `-v` teardown.
- SRD API has **no backgrounds/feats endpoints** -> covered by our content
  system (`dnd_site` DB).
- Homebrew-into-SRD-collections is a step-1 **go/no-go check**, not an
  assumption; fallback is merged endpoints on our API.
- vue-router 5 / pinia 4 are current majors — install, build, pin back if
  anything breaks.
- SRD rate limit (50 req/s) is ample for dev; portraits stored as data URLs in
  the character doc (or added later via a volume).
- The SRD API's Redis cache is flushed and prewarmed on every container start,
  so newly inserted homebrew docs may need a container restart to appear in
  cached list responses.

## Decisions (from planning Q&A)

- Storage: backend + database (MongoDB), official 5e-srd-api + own API
- Rules depth: full SRD content via pickers, sheet-based (no full auto-leveling
  builder yet)
- UI: Tailwind CSS
- Sheet content: core stats & combat, equipment & attacks, spells, personality &
  notes
- Layout: root frontend + `server/` folder
- Auth: full login with accounts

## Decisions (from plan audit, 2026-10-17)

- Node pinned to **24 LTS** (`.nvmrc` + `engines`); Node 20.15 in the planning
  environment fails Vite 8's `^20.19 || >=22.12` requirement
- Docker: **published GHCR images, pinned** (`5e-srd-api:v5.11.0`,
  `5e-database:v4.7.0`, `redis:6.2.5`); no local checkout of the SRD repo
  needed; compose overrides `NODE_ENV=development`, `MONGODB_URI`, `REDIS_URL`
- Persistence: explicit named volume `mongo-data` -> `/data/db2`
- Rules scope for release 1: **2014 SRD only** (`/api/2014`)
- Custom content for release 1: **backgrounds, feats, custom spells** (races/
  classes deferred)
- Homebrew insertion into SRD collections is a step-1 **go/no-go gate**, with
  merged-endpoint fallback
- Git: repo initialized but no commits yet — initial commit is step 1

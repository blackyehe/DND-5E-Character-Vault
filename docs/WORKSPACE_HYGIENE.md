# Keeping development artifacts bounded

The November 2026 cleanup removed 21.64 GB of retained test databases, transformed
test modules, duplicate dependency installs and disposable browser profiles.
Those artifacts supported development checks; they did not speed up the hosted
application. Source snapshots, campaign exports and recovery archives were kept.

## Defaults and checks

Vitest's filesystem module cache is disabled in `vitest.config.ts`, and its
default worker count is two. This trades some repeat-test speed for bounded disk
use and lower peak resource demand. Application and browser runtime caches are
unchanged.

`npm.cmd test` runs a storage preflight before Vitest. Run it independently with:

```powershell
npm.cmd run workspace:check
```

The preflight rejects more than 1 GiB in the managed scratch area or more than
256 MiB in `node_modules/.vitest-cache`. The same check runs before a new managed
workspace is created. These are preflight checks, not a monitor that interrupts
an already-running job. Existing historical snapshots are outside this policy.
Linked dependency installations are reported without traversing their cache;
check or clean that cache from its owning project instead.

The root helper accompanies `package.json` in frozen source packages so their
test preflight remains available even when deployment tooling excludes scripts.

## Disposable runs

Keep temporary MongoDB data directories, browser profiles, source experiments
and large traces in a managed workspace. A command can use `DND_TEMP_DIR`:

```powershell
npm.cmd run workspace:run -- map-check -- node scripts/my-check.mjs
```

The working directory stays at the repository root. The child must explicitly
use `process.env.DND_TEMP_DIR` for disposable files. It inherits the existing
environment without writing environment values into the workspace marker.
Use `node` for JavaScript runners on Windows rather than invoking a `.cmd` file
through this shell-free wrapper.

A JavaScript harness can use the helper directly:

```javascript
import {withTemporaryWorkspace} from '../workspace-artifacts.mjs' // From scripts/.

await withTemporaryWorkspace('map-check', async directory => {
  // Put temporary database files, browser profiles and large traces here.
  try {
    // Run the check. Copy only selected, small results to a retained location.
  } finally {
    // Close browser contexts and stop fixture servers/database processes here.
  }
}) // The helper removes its marked directory, including on a failed check.
```

The helper must own its directory until the callback finishes. Do not remove or
rewrite its marker from a harness. Dropping MongoDB collections does not remove
MongoDB's data/journal files; stopping the server and removing its scratch
directory does.

## Interrupted runs and conservative cleanup

```powershell
npm.cmd run workspace:clean
npm.cmd run workspace:clean -- --apply
```

The first command previews eligibility and deletes nothing. The second removes
only inactive, marked run directories directly under `.local/disposable`, plus
a recognized Vitest cache. It skips active owner/child processes, active MongoDB
locks, unmarked folders, links and Git metadata. It does not sweep historical
`.local`, `.preview.local`, `backups` or `output` folders, or delete database
records. If a process or filesystem lock prevents cleanup, the failure remains
visible for review instead of forcing deletion.

Never put real campaign exports, credentials, retained evidence or Git worktrees
inside this disposable area, and never add a marker to an existing folder merely
to make cleanup delete it. After a hard crash, inspect the dry run and stop the
fixture's processes before applying cleanup. A hard kill/power loss can bypass
`finally`; the markers and preflight budget make those leftovers visible.

## Retention

- Reuse the main dependency installs where package versions permit. Retain
  manifests/lockfiles rather than copies of `node_modules` in old snapshots.
- Keep concise reports and selected screenshots. Record a purpose and review
  date when deliberately retaining a large artifact. Recovery backups do not
  become automatically disposable when that date passes.
- Preserve source checkpoints in Git and private recovery archives outside the
  project. Keep a separate-drive copy of private recovery data before deleting
  original backups. Git does not back up ignored data.
- Keep `.local` and `.preview.local` excluded from IDE/Tailwind discovery. Manage
  registered worktrees through Git rather than deleting their parent folders.

The retained `notebook_navigation_fixture_v1` fixture is intentionally reused in
the existing local MongoDB service. It is not a per-run data-directory copy and
is never removed by the scratch cleanup command.

The filesystem safety regressions run with `npm.cmd run test:workspace`. They
use isolated temporary projects and verify refusal of active, unmarked, linked
and Git-managed data, as well as cleanup after success and failure.

import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {createTemporaryWorkspace, withTemporaryWorkspace, cleanWorkspaces, checkWorkspaceBudget} from '../workspace-artifacts.mjs'

function project(t) {
  const temp = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(temp, 'dnd-hygiene-test-'))
  t.after(() => {
    assert.equal(path.dirname(root), temp)
    assert.ok(path.basename(root).startsWith('dnd-hygiene-test-'))
    fs.rmSync(root, {recursive: true, force: true})
  })
  return root
}
function finish(directory, extra = {}) {
  const file = path.join(directory, '.dnd-disposable.json'), marker = JSON.parse(fs.readFileSync(file, 'utf8'))
  fs.writeFileSync(file, JSON.stringify({...marker, state: 'finished', ownerPid: null, childPid: null, ...extra}))
}

test('successful and failed runs remove their own temporary files', async t => {
  const root = project(t)
  let successful, failed
  assert.equal(await withTemporaryWorkspace('success', directory => {
    successful = directory; fs.writeFileSync(path.join(directory, 'output'), 'temporary'); return 42
  }, {root}), 42)
  assert.equal(fs.existsSync(successful), false)
  await assert.rejects(withTemporaryWorkspace('failure', directory => {
    failed = directory; fs.writeFileSync(path.join(directory, 'output'), 'temporary'); throw Error('fixture failed')
  }, {root}), /fixture failed/)
  assert.equal(fs.existsSync(failed), false)
})

test('cleanup is a dry run by default and explicit apply removes only marked inactive runs', t => {
  const root = project(t), directory = createTemporaryWorkspace('old', {root})
  finish(directory)
  const unmarked = path.join(path.dirname(directory), 'private-backup')
  fs.mkdirSync(unmarked); fs.writeFileSync(path.join(unmarked, 'keep'), 'private')
  const preview = cleanWorkspaces({root})
  assert.equal(preview.dryRun, true); assert.equal(fs.existsSync(directory), true)
  const applied = cleanWorkspaces({root, apply: true})
  assert.deepEqual(applied.removed, [directory]); assert.equal(fs.readFileSync(path.join(unmarked, 'keep'), 'utf8'), 'private')
})

test('an active owner or child process prevents removal', t => {
  const root = project(t), directory = createTemporaryWorkspace('active', {root})
  assert.deepEqual(cleanWorkspaces({root, apply: true}).removed, [])
  finish(directory, {childPid: process.pid})
  assert.deepEqual(cleanWorkspaces({root, apply: true}).removed, [])
  assert.equal(fs.existsSync(directory), true)
})

test('an active MongoDB lock prevents removal even after its harness lease ends', t => {
  const root = project(t), directory = createTemporaryWorkspace('mongo', {root})
  finish(directory); fs.writeFileSync(path.join(directory, 'mongod.lock'), String(process.pid))
  assert.deepEqual(cleanWorkspaces({root, apply: true}).removed, [])
  assert.match(cleanWorkspaces({root}).runs[0].reason, /MongoDB/)
})

test('Git worktree metadata prevents removal', t => {
  const root = project(t), directory = createTemporaryWorkspace('worktree', {root})
  finish(directory); fs.writeFileSync(path.join(directory, '.git'), 'gitdir: preserved')
  assert.deepEqual(cleanWorkspaces({root, apply: true}).removed, [])
  assert.equal(fs.existsSync(path.join(directory, '.git')), true)
})

test('links inside a marked run are not followed or removed', t => {
  const root = project(t), directory = createTemporaryWorkspace('linked', {root}), outside = path.join(root, 'real-data')
  fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'keep'), 'source')
  fs.symlinkSync(outside, path.join(directory, 'link'), process.platform === 'win32' ? 'junction' : 'dir')
  finish(directory)
  assert.deepEqual(cleanWorkspaces({root, apply: true}).removed, [])
  assert.equal(fs.readFileSync(path.join(outside, 'keep'), 'utf8'), 'source')
})

test('a linked .local ancestor is rejected before creating or cleaning artifacts', t => {
  const root = project(t), outside = path.join(root, 'real-data')
  fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'keep'), 'source')
  fs.symlinkSync(outside, path.join(root, '.local'), process.platform === 'win32' ? 'junction' : 'dir')
  assert.throws(() => createTemporaryWorkspace('escape', {root}), /linked/)
  assert.throws(() => cleanWorkspaces({root, apply: true}), /linked/)
  assert.equal(fs.readFileSync(path.join(outside, 'keep'), 'utf8'), 'source')
})

test('marker tampering and path-like labels never become deletion targets', t => {
  const root = project(t), directory = createTemporaryWorkspace('tampered', {root})
  const marker = path.join(directory, '.dnd-disposable.json')
  fs.writeFileSync(marker, JSON.stringify({format: 'dnd-disposable-v1', id: '../real-data'}))
  assert.deepEqual(cleanWorkspaces({root, apply: true}).removed, [])
  assert.throws(() => createTemporaryWorkspace('../real-data', {root}), /label/)
})

test('an existing unmarked scratch root is preserved for review', t => {
  const root = project(t), base = path.join(root, '.local', 'disposable')
  fs.mkdirSync(base, {recursive: true}); fs.writeFileSync(path.join(base, 'keep'), 'private')
  assert.throws(() => createTemporaryWorkspace('new', {root}))
  assert.throws(() => cleanWorkspaces({root, apply: true}))
  assert.equal(fs.readFileSync(path.join(base, 'keep'), 'utf8'), 'private')
})

test('the storage preflight rejects oversized managed artifacts and caches without deleting them', t => {
  const root = project(t), directory = createTemporaryWorkspace('budget', {root})
  fs.writeFileSync(path.join(directory, 'large'), 'fixture')
  assert.throws(() => checkWorkspaceBudget({root, managedLimitBytes: 1}), /budget exceeded/)
  assert.equal(fs.existsSync(directory), true)
  const cache = path.join(root, 'node_modules', '.vitest-cache')
  fs.mkdirSync(cache, {recursive: true}); fs.writeFileSync(path.join(cache, 'large'), 'cache')
  assert.throws(() => checkWorkspaceBudget({root, cacheLimitBytes: 1}), /budget exceeded/)
})

test('cache cleanup requires the known Vitest marker and preserves main dependencies', t => {
  const root = project(t), cache = path.join(root, 'node_modules', '.vitest-cache'), dependency = path.join(root, 'node_modules', 'keep')
  fs.mkdirSync(cache, {recursive: true}); fs.writeFileSync(dependency, 'installed package')
  assert.deepEqual(cleanWorkspaces({root, apply: true}).removed, [])
  fs.writeFileSync(path.join(cache, 'CACHEDIR.TAG'), '# This file is a cache directory tag created by Vitest.')
  assert.deepEqual(cleanWorkspaces({root, apply: true}).removed, [cache])
  assert.equal(fs.readFileSync(dependency, 'utf8'), 'installed package')
})

test('shared dependency installs allow preflight without traversing or deleting the owning cache', t => {
  const root = project(t), shared = path.join(root, 'shared-packages'), cache = path.join(shared, '.vitest-cache')
  fs.mkdirSync(cache, {recursive: true}); fs.writeFileSync(path.join(cache, 'CACHEDIR.TAG'), '# created by Vitest')
  fs.writeFileSync(path.join(cache, 'keep'), 'shared cache')
  fs.symlinkSync(shared, path.join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  assert.match(checkWorkspaceBudget({root}).cache.reason, /linked/)
  assert.deepEqual(cleanWorkspaces({root, apply: true}).removed, [])
  assert.equal(fs.readFileSync(path.join(cache, 'keep'), 'utf8'), 'shared cache')
})

test('CLI forwards DND_TEMP_DIR and removes scratch files after successful and failed child commands', t => {
  const root = project(t), helper = path.join(root, 'workspace-artifacts.mjs')
  fs.copyFileSync(fileURLToPath(new URL('../workspace-artifacts.mjs', import.meta.url)), helper)
  for (const exit of [0, 7]) {
    const code = `const fs=require('node:fs');console.log(process.env.DND_TEMP_DIR);fs.writeFileSync(require('node:path').join(process.env.DND_TEMP_DIR,'result'),'temporary');process.exitCode=${exit}`
    const result = spawnSync(process.execPath, [helper, 'run', 'cli-check', '--', process.execPath, '-e', code], {encoding: 'utf8'})
    assert.equal(result.status, exit, result.stderr)
    const directory = result.stdout.trim()
    assert.equal(path.dirname(directory), path.join(root, '.local', 'disposable'))
    assert.equal(fs.existsSync(directory), false)
  }
})

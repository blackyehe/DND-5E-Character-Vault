import fs from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {spawn} from 'node:child_process'
import {fileURLToPath, pathToFileURL} from 'node:url'

const PROJECT_ROOT = fileURLToPath(new URL('./', import.meta.url))
const ROOT_MARKER = '.dnd-scratch-root.json'
const RUN_MARKER = '.dnd-disposable.json'
const FORMAT = 'dnd-disposable-v1'
const MiB = 1024 * 1024
export const MANAGED_LIMIT_BYTES = 1024 * MiB
export const CACHE_LIMIT_BYTES = 256 * MiB

function paths(root = PROJECT_ROOT) {
  root = path.resolve(root)
  return {root, base: path.join(root, '.local', 'disposable'), cache: path.join(root, 'node_modules', '.vitest-cache')}
}

function assertPlainPath(root, target) {
  const relative = path.relative(root, target)
  if (!relative || relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) {
    throw Error('Cleanup target must be strictly inside the project.')
  }
  let current = root
  for (const part of ['', ...relative.split(path.sep)]) {
    if (part) current = path.join(current, part)
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        const error = Error('Refusing a linked scratch/cache path: ' + current)
        error.code = 'LINKED_PATH'
        throw error
      }
    } catch (error) {
      if (error.code === 'ENOENT') break
      throw error
    }
  }
}

function readJson(file) {
  const stat = fs.lstatSync(file)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw Error('Invalid scratch marker.')
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function managedRoot(root, create = false) {
  const p = paths(root)
  assertPlainPath(p.root, p.base)
  if (!fs.existsSync(p.base)) {
    if (!create) return p
    fs.mkdirSync(p.base, {recursive: true})
    fs.writeFileSync(path.join(p.base, ROOT_MARKER), JSON.stringify({format: FORMAT}), {flag: 'wx'})
  }
  if (readJson(path.join(p.base, ROOT_MARKER)).format !== FORMAT) throw Error('Unrecognized scratch root; preserve it for review.')
  return p
}

const validPid = pid => Number.isSafeInteger(pid) && pid > 0
function isAlive(pid) {
  if (!validPid(pid)) return false
  try { process.kill(pid, 0); return true } catch (error) {
    if (error.code === 'EPERM') return true
    if (error.code === 'ESRCH') return false
    throw error
  }
}

function runMarker(directory) {
  const marker = readJson(path.join(directory, RUN_MARKER))
  if (marker.format !== FORMAT || marker.id !== path.basename(directory) ||
      !['running', 'finished'].includes(marker.state) || !Number.isFinite(Date.parse(marker.createdAt)) ||
      !(marker.ownerPid === null || validPid(marker.ownerPid)) ||
      !(marker.childPid === null || validPid(marker.childPid)) ||
      marker.state === 'running' && !validPid(marker.ownerPid)) throw Error('Unrecognized disposable-run marker.')
  return marker
}

function inspectTree(directory, {checkMongoLocks = true} = {}) {
  let bytes = 0, unsafe, activeMongo = false
  const stack = [directory]
  while (stack.length) {
    const current = stack.pop(), stat = fs.lstatSync(current)
    if (stat.isSymbolicLink()) { unsafe = 'contains a link'; continue }
    if (path.basename(current) === '.git') { unsafe = 'contains Git metadata'; continue }
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(current)) stack.push(path.join(current, name))
    } else {
      bytes += stat.size
      if (checkMongoLocks && path.basename(current) === 'mongod.lock' && stat.size <= 64) {
        const pid = Number(fs.readFileSync(current, 'utf8').trim())
        if (validPid(pid) && isAlive(pid)) activeMongo = true
      }
    }
  }
  return {bytes, unsafe, activeMongo}
}

function inspectRun(root, directory) {
  assertPlainPath(root, directory)
  let marker, reason
  try { marker = runMarker(directory) } catch { reason = 'unmarked or invalid marker' }
  const active = marker && (isAlive(marker.ownerPid) || isAlive(marker.childPid))
  // A live harness already prevents deletion; do not try to read its DB locks.
  const tree = inspectTree(directory, {checkMongoLocks: !active})
  if (tree.unsafe) reason = tree.unsafe
  else if (tree.activeMongo) reason = 'MongoDB process is active'
  else if (active) reason = 'run process is active'
  return {path: directory, bytes: tree.bytes, eligible: !reason, reason}
}

function inspectCache(root) {
  const p = paths(root)
  try { assertPlainPath(p.root, p.cache) } catch (error) {
    if (error.code !== 'LINKED_PATH') throw error
    // Frozen source checks can borrow the main dependency install. Its cache
    // belongs to the owning project; never inspect or delete through that link.
    return {path: p.cache, bytes: 0, eligible: false, reason: 'linked dependency/cache path; not traversed'}
  }
  if (!fs.existsSync(p.cache)) return {path: p.cache, bytes: 0, eligible: false, reason: 'absent'}
  const tree = inspectTree(p.cache)
  let recognized = false
  try {
    const tag = path.join(p.cache, 'CACHEDIR.TAG'), stat = fs.lstatSync(tag)
    recognized = stat.isFile() && !stat.isSymbolicLink() && stat.size < 4096 &&
      fs.readFileSync(tag, 'utf8').includes('created by Vitest')
  } catch { /* Unrecognized caches are never removed. */ }
  const reason = tree.unsafe || (recognized ? undefined : 'unrecognized cache marker')
  return {path: p.cache, bytes: tree.bytes, eligible: !reason, reason}
}

export function inspectWorkspaces({root = PROJECT_ROOT} = {}) {
  const p = managedRoot(root), runs = []
  if (fs.existsSync(p.base)) {
    for (const entry of fs.readdirSync(p.base, {withFileTypes: true})) {
      if (entry.name === ROOT_MARKER) continue
      const directory = path.join(p.base, entry.name)
      if (entry.isSymbolicLink() || !entry.isDirectory()) {
        runs.push({path: directory, bytes: entry.isFile() ? fs.lstatSync(directory).size : 0, eligible: false, reason: 'unmanaged file or link'})
      } else runs.push(inspectRun(p.root, directory))
    }
  }
  return {runs, managedBytes: runs.reduce((sum, run) => sum + run.bytes, 0), cache: inspectCache(p.root)}
}

export function checkWorkspaceBudget({root = PROJECT_ROOT, managedLimitBytes = MANAGED_LIMIT_BYTES, cacheLimitBytes = CACHE_LIMIT_BYTES} = {}) {
  const report = inspectWorkspaces({root})
  if (report.managedBytes > managedLimitBytes || report.cache.bytes > cacheLimitBytes) {
    throw Error('Disposable workspace/cache budget exceeded. Run npm run workspace:clean to review leftovers; stop active runs before applying cleanup.')
  }
  return report
}

export function cleanWorkspaces({root = PROJECT_ROOT, apply = false} = {}) {
  const p = paths(root), report = inspectWorkspaces({root}), removed = []
  for (const item of [...report.runs, report.cache]) {
    if (!item.eligible || !apply) continue
    // Recheck the exact marked target immediately before recursive removal.
    assertPlainPath(p.root, item.path)
    const current = item.path === p.cache ? inspectCache(p.root) : inspectRun(p.root, item.path)
    if (!current.eligible) throw Error('Cleanup target changed or became active: ' + item.path)
    if (item.path !== p.cache && path.dirname(item.path) !== p.base) throw Error('Unexpected disposable target.')
    fs.rmSync(item.path, {recursive: true, maxRetries: 3, retryDelay: 100})
    removed.push(item.path)
  }
  return {...report, dryRun: !apply, removed}
}

export function createTemporaryWorkspace(label, {root = PROJECT_ROOT} = {}) {
  if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(label)) throw Error('Use a short lowercase label containing letters, numbers and hyphens.')
  checkWorkspaceBudget({root})
  const p = managedRoot(root, true), id = label + '-' + randomUUID(), directory = path.join(p.base, id)
  assertPlainPath(p.root, directory)
  fs.mkdirSync(directory)
  fs.writeFileSync(path.join(directory, RUN_MARKER), JSON.stringify({
    format: FORMAT, id, createdAt: new Date().toISOString(), state: 'running', ownerPid: process.pid, childPid: null,
  }), {flag: 'wx'})
  return directory
}

export async function withTemporaryWorkspace(label, task, {root = PROJECT_ROOT} = {}) {
  const directory = createTemporaryWorkspace(label, {root})
  try { return await task(directory) } finally {
    const marker = runMarker(directory)
    if (marker.ownerPid !== process.pid) throw Error('Disposable-run ownership changed; preserving it for review.')
    marker.state = 'finished'; marker.ownerPid = null
    fs.writeFileSync(path.join(directory, RUN_MARKER), JSON.stringify(marker))
    const current = inspectRun(paths(root).root, directory)
    if (!current.eligible) throw Error('Preserved scratch run: ' + current.reason + ' (' + directory + ')')
    fs.rmSync(directory, {recursive: true, maxRetries: 3, retryDelay: 100})
  }
}

async function main(args) {
  const [command, ...rest] = args
  if (command === 'check' && !rest.length) {
    const report = checkWorkspaceBudget()
    console.log(`[workspace] Scratch ${(report.managedBytes / MiB).toFixed(1)}/1024 MiB (${report.runs.length} runs); Vitest cache ${(report.cache.bytes / MiB).toFixed(1)}/256 MiB.`)
    if (report.cache.reason?.startsWith('linked')) console.log('[workspace] Shared dependency cache was not inspected; check it from its owning project.')
  } else if (command === 'clean' && rest.every(arg => arg === '--apply') && rest.length <= 1) {
    console.log(JSON.stringify(cleanWorkspaces({apply: rest.includes('--apply')}), null, 2))
  } else if (command === 'run' && rest[1] === '--' && rest.length >= 3) {
    const [label, , executable, ...childArgs] = rest
    process.exitCode = await withTemporaryWorkspace(label, directory => new Promise((resolve, reject) => {
      const child = spawn(executable, childArgs, {cwd: PROJECT_ROOT, env: {...process.env, DND_TEMP_DIR: directory}, stdio: 'inherit'})
      child.once('spawn', () => {
        const marker = runMarker(directory); marker.childPid = child.pid
        fs.writeFileSync(path.join(directory, RUN_MARKER), JSON.stringify(marker))
      })
      const interrupt = () => child.kill('SIGINT'), terminate = () => child.kill('SIGTERM')
      process.once('SIGINT', interrupt); process.once('SIGTERM', terminate)
      child.once('error', reject)
      child.once('close', code => {
        process.off('SIGINT', interrupt); process.off('SIGTERM', terminate)
        resolve(code ?? 1)
      })
    }))
  } else {
    throw Error('Usage: workspace-artifacts.mjs check | clean [--apply] | run <label> -- node <script> [args]')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1 })
}

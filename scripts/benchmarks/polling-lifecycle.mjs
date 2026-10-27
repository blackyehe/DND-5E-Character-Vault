import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Deterministic request scheduling, not a network/CPU latency benchmark.
const label = process.argv[2] ?? 'check'
assert.match(label, /^[a-z0-9-]+$/)
const directory = resolve('.local/polling-20261027')
const destination = resolve(directory, `${label}.json`)
if (label === 'before') assert.ok(!existsSync(destination), 'Preserve the existing pre-change baseline')
const run = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'src/composables/usePartyDashboard.test.ts', '--reporter=dot'], { encoding: 'utf8' })
assert.equal(run.status, 0, run.stderr + run.stdout)
const trace = run.stdout.split(/\r?\n/).find(line => line.startsWith('POLLING_TIMELINE '))
assert.ok(trace, 'The real party composable must emit its measured request trace')
const result = JSON.parse(trace.slice('POLLING_TIMELINE '.length))
if (label !== 'before') assert.deepEqual(result, JSON.parse(readFileSync(resolve(directory, 'before.json'), 'utf8')))
mkdirSync(directory, { recursive: true })
writeFileSync(destination, JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ label, baselineMatches: label !== 'before', method: 'Fake clock; real party composable; stubbed HTTP responses', ...result }))

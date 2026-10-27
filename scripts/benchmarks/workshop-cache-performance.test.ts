import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { cpus } from 'node:os'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  revisions: new Map<string, number>(),
  sources: new Map<string, string>(),
  reads: [] as string[],
}))
vi.mock('../../server/models/CustomContent', () => ({ CustomContent: { find: (filter: { userId: string }) => {
  const owner = filter.userId, revision = state.revisions.get(owner) ?? 1
  const query = {
    select: () => query,
    sort: () => query,
    lean: async () => [{ _id: owner, updatedAt: new Date(revision), sourceHash: `${owner}-${revision}` }],
  }
  return query
} } }))
vi.mock('../../server/models/Character', () => ({ Character: {} }))
vi.mock('../../server/lib/pack-source', () => ({ readPackDocuments: async (owner: string) => {
  state.reads.push(owner)
  const revision = state.revisions.get(owner) ?? 1
  return [{
    _id: owner, updatedAt: new Date(revision), sourceHash: `${owner}-${revision}`,
    data: { filename: `${owner}.orcbrew`, source: state.sources.get(`${owner}-${revision}`)! },
  }]
} }))

const label = process.env.WORKSHOP_CACHE_BENCHMARK_LABEL
const directory = resolve('.local/workshop-cache-2026-10-27')
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

it.skipIf(!label)('measures owner replacement and normal cache traffic with real parsing/catalog/rules', async () => {
  if (!label || !/^(before|after)-[1-5]$/.test(label)) throw Error('Use a fresh before-N/after-N pair, N=1..5')
  if (!global.gc) throw Error('Run Vitest with --execArgv=--expose-gc for memory observations')
  const log = vi.spyOn(console, 'info').mockImplementation(() => {})
  try {
    // Fictional, deterministic packs; no .env, database or network access.
    for (const owner of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) for (const revision of [1, 2]) {
      const spells = Array.from({ length: 300 }, (_, i) => `:spell-${i} {:name "${owner} spell ${i} v${revision}" :level ${i % 10} :description "${'A fictional rule. '.repeat(32)}"}`).join(' ')
      const races = Array.from({ length: 16 }, (_, i) => `:race-${i} {:name "${owner} race ${i} v${revision}" :description "Fictional race ${i}"}`).join(' ')
      state.sources.set(`${owner}-${revision}`, `{:orcpub.dnd.e5/spells {${spells}} :orcpub.dnd.e5/races {${races}}}`)
    }
    const outputs: Record<string, string> = {}, rows = [], memory = []
    const snapshot = (scenario: string, stage: string) => {
      global.gc!()
      memory.push({ scenario, stage, ...process.memoryUsage(), maxRssKiB: process.resourceUsage().maxRSS })
    }
    for (const scenario of ['replacement', 'recency', 'steady'] as const) {
      vi.resetModules()
      state.revisions.clear()
      state.reads = []
      const { workshopLibrary } = await import('../../server/lib/workshop-library')
      snapshot(scenario, 'empty')
      const request = async (step: string, owner: string) => {
        const reads = state.reads.length, start = performance.now()
        const value = await workshopLibrary(owner)
        const ms = performance.now() - start
        rows.push({ scenario, step, owner, ms, sourceReads: state.reads.length - reads })
        outputs[`${scenario}/${step}`] = hash(value)
      }
      for (const owner of ['A', 'B', 'C', 'D']) await request(`fill-${owner}`, owner)
      snapshot(scenario, 'four-owners')
      if (scenario !== 'steady') {
        state.revisions.set('C', 2)
        await request('revise-C', 'C')
        snapshot(scenario, 'after-revision')
      }
      const owners = scenario === 'replacement' ? ['A', 'B', 'D', 'C']
        : scenario === 'recency' ? ['E', 'F', 'G', 'C']
          : ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'E', 'B', 'C', 'D', 'E']
      for (const [i, owner] of owners.entries()) await request(`request-${i}-${owner}`, owner)
      snapshot(scenario, 'finished')
    }
    if (label.startsWith('after')) {
      const baseline = JSON.parse(readFileSync(resolve(directory, `${label.replace('after', 'before')}.json`), 'utf8'))
      expect(outputs).toEqual(baseline.outputs)
    }
    mkdirSync(directory, { recursive: true })
    writeFileSync(resolve(directory, `${label}.json`), JSON.stringify({
      label, measuredAt: new Date().toISOString(), node: process.version, cpu: cpus()[0]?.model,
      sourceBytesPerPack: Buffer.byteLength(state.sources.get('A-1')!),
      method: 'Fresh Vitest worker; stubbed revision/source IO; real parser/catalog/rules. Request timing excludes output hashing and forced GC. Heap/RSS are whole-worker observations, not cache byte sizes. No network/DB/browser.',
      outputs, rows, memory,
    }, null, 2) + '\n', { flag: 'wx' })
  } finally { log.mockRestore() }
}, 120000)

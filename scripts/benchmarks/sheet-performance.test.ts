import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { cpus } from 'node:os'
import { it, expect } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia, disposePinia } from 'pinia'
import CoreTab from '../../src/components/sheet/CoreTab.vue'
import { useCharactersStore } from '../../src/stores/characters'
import { characterBenefits } from '../../shared/rule-benefits'
import { partyMemberSnapshot } from '../../shared/party-dashboard'
import { expandedSheet } from '../../server/extension/sheet'
import type { WorkshopLibrary } from '../../server/lib/workshop-library'
import { sheetFixtures, emptyRuleLibrary } from './sheet-fixtures'

const label = process.env.SHEET_BENCHMARK_LABEL
const directory = resolve('.local/optimization-2026-10-27')
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

async function measure(operation: () => unknown | Promise<unknown>) {
  for (let i = 0; i < 10; i++) await operation()
  const calibration = performance.now()
  for (let i = 0; i < 5; i++) await operation()
  const iterations = Math.min(2000, Math.max(1, Math.ceil(25 / ((performance.now() - calibration) / 5))))
  const samples: number[] = []
  for (let sample = 0; sample < 15; sample++) {
    const start = performance.now()
    for (let i = 0; i < iterations; i++) await operation()
    samples.push((performance.now() - start) / iterations)
  }
  samples.sort((a, b) => a - b)
  return { medianMs: samples[7]!, p90Ms: samples[13]!, iterations, samplesMs: samples }
}

it.skipIf(!label)('measures fixed sheet CPU workloads and checks baseline output equivalence', async () => {
  if (!label || !/^[a-z0-9-]+$/.test(label)) throw Error('Choose a simple benchmark label')
  const rows = [], outputs: Record<string, string> = {}
  for (const [fixture, character] of Object.entries(sheetFixtures())) {
    const render = async () => {
      const pinia = createPinia(), app = createSSRApp({ render: () => h(CoreTab) })
      app.use(pinia); useCharactersStore(pinia).current = structuredClone(character)
      try { return await renderToString(app) } finally { disposePinia(pinia) }
    }
    const operations = {
      benefits: () => characterBenefits(character),
      partySnapshot: () => partyMemberSnapshot(character),
      pluginProjection: () => expandedSheet(character, emptyRuleLibrary as WorkshopLibrary),
      coreTabSSR: render,
    }
    for (const [workload, operation] of Object.entries(operations)) {
      outputs[`${fixture}/${workload}`] = hash(await operation())
      const timing = await measure(operation)
      rows.push({ fixture, workload, ...timing })
      console.log(`${fixture}/${workload}: ${timing.medianMs.toFixed(4)} ms median; ${timing.p90Ms.toFixed(4)} ms p90`)
    }
    // Same object, nested edits: catches accidentally retained benefits after play changes.
    character.equipment[0]!.attuned = false
    if (character.compendiumRules?.[0]) character.compendiumRules[0].entry.benefits = []
    character.meta.level = 10
    for (const [workload, operation] of Object.entries(operations)) outputs[`${fixture}/edited/${workload}`] = hash(await operation())
  }
  if (label !== 'before') {
    const baseline = JSON.parse(readFileSync(resolve(directory, 'before.json'), 'utf8'))
    expect(outputs).toEqual(baseline.outputs)
  }
  mkdirSync(directory, { recursive: true })
  writeFileSync(resolve(directory, `${label}.json`), JSON.stringify({ label, node: process.version, cpu: cpus()[0]?.model, measuredAt: new Date().toISOString(), method: '15 warmed samples; target ~25ms/sample, bounded to 1–2000 iterations; median ms/operation. Fictional data, no DB/network/browser layout.', outputs, rows }, null, 2) + '\n')
}, 120000)

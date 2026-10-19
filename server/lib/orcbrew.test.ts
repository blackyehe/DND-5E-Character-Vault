import { describe, expect, it } from 'vitest'
import { readEdn } from './edn'
import { buildOrcbrewCatalog, inspectOrcbrew, sourceHash, type CatalogPack } from './orcbrew'
import { parsedPack } from './orcbrew-library'

const definition = (description = 'First rule', extras = '') => `{:name "Shared Spell" :key :shared :description "${description}" :level 1 ${extras}}`
const source = (entry = definition()) => `{:orcpub.dnd.e5/spells {:shared ${entry}}}`
const pack = (text: string, id = 'first', filename = 'first.orcbrew'): CatalogPack => ({ id, filename, parsed: inspectOrcbrew(text) })

describe('EDN reader', () => {
  it('reads BOM, comments, numeric keys, sets, strings, characters, and tagged data', () => {
    const value = readEdn('\uFEFF; comment\n{1 #{:a :b} :text "line\\n\\u00e9" :char \\] :tag #custom/value {:a true} :big 9007199254740993N}') as Record<string, unknown>
    expect(value['1']).toEqual([':a', ':b'])
    expect(value[':text']).toBe('line\né')
    expect(value[':char']).toBe(']')
    expect(value[':tag']).toEqual({ ':edn/tag': 'custom/value', ':edn/value': { ':a': true } })
    expect(value[':big']).toBe('9007199254740993')
  })

  it('handles non-finite numbers without breaking otherwise valid files', () => {
    const result = inspectOrcbrew(source(definition('Rule', ':values [##NaN ##Inf ##-Inf 1.25e2]')))
    expect(result.report.nonFiniteCount).toBe(3)
    expect((result.entries.spells[0]!.details as Record<string, unknown>)[':values']).toEqual([null, null, null, 125])
    expect(result.report.warnings).toHaveLength(1)
  })

  it('discards reader forms at collection boundaries and after the root', () => {
    expect(readEdn('{:a #_99 1 :b [2 #_3]} #_ {:ignored true}')).toEqual({ ':a': 1, ':b': [2] })
  })

  it.each(['{:a [1}', '{:a}', '{:a 1 :a 2}', '{} {}', '{:a "bad\\q"}', '#=(dangerous)'])('rejects invalid or executable syntax: %s', (text) => {
    expect(() => readEdn(text)).toThrow()
  })

  it('bounds nesting and handles prototype-like keys as data', () => {
    expect(() => readEdn('['.repeat(140) + '0' + ']'.repeat(140))).toThrow(/nesting/)
    const value = readEdn('{"__proto__" {:safe true}}') as Record<string, unknown>
    expect(Object.getPrototypeOf(value)).toBeNull()
    expect(value.__proto__).toEqual({ ':safe': true })
  })
})

describe('Orcbrew imports and overlaps', () => {
  it('accepts single packs and named collections, retaining all recognized and unknown sections', () => {
    const document = inspectOrcbrew(`{"One" ${source()} "Two" {:orcpub.dnd.e5/monsters {:beast {:name "Beast" :hit-points {:die-count 2 :die 8 :modifier 3}}} :orcpub.dnd.e5/future {:item {:name "Future"}}}}`)
    expect(document.report.packCount).toBe(2)
    expect(document.report.entryCount).toBe(3)
    expect(document.entries.monsters[0]!.hit_points).toBe(12)
    expect(document.entries.other[0]!.name).toBe('Future')
    expect(document.report.warnings[0]).toMatch(/future/)
  })

  it('merges identical definitions across files, preserving provenance and legacy references', () => {
    const first = pack(source(), 'a', 'alpha.orcbrew')
    const second = pack(source(definition('First rule', ':option-pack "Beta" :edit-event [:ignored]')), 'b', 'beta.orcbrew')
    const merged = buildOrcbrewCatalog([first, second]).spells
    expect(merged).toHaveLength(1)
    expect(merged[0]!.sourcePacks).toEqual(['alpha.orcbrew', 'beta.orcbrew'])
    expect(merged[0]!.aliases).toEqual(['homebrew-a-shared', 'homebrew-b-shared'])
    expect(merged[0]!.index).toBe(buildOrcbrewCatalog([second]).spells[0]!.index)
  })

  it('keeps differing rules as distinct labelled versions and is independent of import order', () => {
    const first = pack(source(), 'a', 'same.orcbrew')
    const second = pack(source(definition('Revised rule')), 'b', 'same.orcbrew')
    const forwards = buildOrcbrewCatalog([first, second]).spells
    const backwards = buildOrcbrewCatalog([second, first]).spells
    expect(forwards).toEqual(backwards)
    expect(forwards).toHaveLength(2)
    expect(new Set(forwards.map((item) => item.displayName)).size).toBe(2)
    expect(forwards.every((item) => String(item.displayName).includes('version'))).toBe(true)
  })

  it('preserves keys and namespaces rather than conflating same-name entries', () => {
    const document = pack(`{:orcpub.dnd.e5/spells {:one/shared ${definition()} :two/shared ${definition()}}}`)
    const entries = buildOrcbrewCatalog([document]).spells
    expect(entries).toHaveLength(2)
    expect(new Set(entries.map((item) => item.index)).size).toBe(2)
    expect(entries.every((item) => (item.aliases as string[]).length === 0)).toBe(true)
  })

  it('retains nested rule references and option flags in semantic identity', () => {
    const one = pack(source(definition('Rule', ':grant {:key :shield :disabled? true}')))
    const two = pack(source(definition('Rule', ':grant {:key :invisibility :disabled? true}')), 'b')
    const three = pack(source(definition('Rule', ':grant {:key :shield :disabled? false}')), 'c')
    expect(buildOrcbrewCatalog([one, two, three]).spells).toHaveLength(3)
  })

  it('ignores map/set ordering and editor state but retains ordered choices', () => {
    const one = pack(source(definition('Rule', ':options #{:a :b} :choices [1 2]')))
    const two = pack(source('{:choices [1 2] :options #{:b :a} :description "Rule" :level 1 :name "Shared Spell" :disabled? false :key :shared}'), 'b')
    expect(buildOrcbrewCatalog([one, two]).spells).toHaveLength(1)
    const three = pack(source(definition('Rule', ':options #{:a :b} :choices [2 1]')), 'c')
    expect(buildOrcbrewCatalog([one, three]).spells).toHaveLength(2)
  })

  it('respects disabled entries and pack settings without changing identity', () => {
    const disabled = pack(`{"Disabled" {:disabled? true :orcpub.dnd.e5/spells {:shared ${definition()}}}}`)
    expect(disabled.parsed.report.disabledCount).toBe(1)
    expect(buildOrcbrewCatalog([disabled]).spells).toHaveLength(0)
    const enabled = buildOrcbrewCatalog([{ ...disabled, includeDisabled: true }]).spells
    expect(enabled[0]!.index).toBe(disabled.parsed.entries.spells[0]!.index)
  })

  it('maps spell components and ritual status and reports internal duplicate definitions', () => {
    const text = source(definition('Rule', ':components {:verbal true :somatic true :material "a feather"} :ritual true'))
    const document = inspectOrcbrew(`{"A" ${text} "B" ${text}}`)
    expect(document.entries.spells[0]!.components).toEqual(['V', 'S', 'M'])
    expect(document.entries.spells[0]!.ritual).toBe(true)
    expect(document.report.duplicateCount).toBe(1)
    expect(document.report.entryCount).toBe(1)
  })

  it('reparses old saved sources instead of trusting stale derived fields', () => {
    const result = parsedPack({ source: source(), entries: { spells: [] } })
    expect(result.entries.spells).toHaveLength(1)
    expect(sourceHash('\uFEFF' + source() + '\r\n')).toBe(sourceHash(source()))
  })

  it.each(['{}', '[]', '{:orcpub.dnd.e5/spells []}', '{:orcpub.dnd.e5/spells {:bad nil}}'])('rejects unsupported document shape: %s', (text) => {
    expect(() => inspectOrcbrew(text)).toThrow()
  })
})

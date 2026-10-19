import { createHash } from 'node:crypto'
import { isEdnSet, readEdn, type EdnValue } from './edn'
export { readEdn } from './edn'

export const ORCBREW_KINDS = [
  'spells', 'races', 'classes', 'backgrounds', 'feats', 'subclasses', 'subraces',
  'monsters', 'languages', 'invocations', 'boons', 'selections', 'other',
] as const
export type OrcbrewKind = typeof ORCBREW_KINDS[number]
export interface OrcbrewEntry extends Record<string, unknown> {
  index: string
  name: string
  contentKey: string
  source: string
  disabled: boolean
  legacyKey: string
}
export type OrcbrewEntries = Record<OrcbrewKind, OrcbrewEntry[]>
export interface OrcbrewReport {
  packCount: number
  entryCount: number
  disabledCount: number
  duplicateCount: number
  nonFiniteCount: number
  counts: Record<OrcbrewKind, number>
  warnings: string[]
}
export interface ParsedOrcbrew { entries: OrcbrewEntries; report: OrcbrewReport }

/** Semantic identity excludes editor state and source labels, but retains every rule field. */
export function canonicalContent(value: unknown): string {
  function clean(item: unknown, depth = 0): unknown {
    if (typeof item === 'string') return item.replace(/\r\n?/g, '\n').trim()
    if (Array.isArray(item)) {
      const values = item.map((child) => clean(child, depth + 1))
      return isEdnSet(item) ? values.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right), 'en')) : values
    }
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.entries(item)
        .filter(([key]) => key !== ':edit-event' && !(depth === 0 && [':option-pack', ':disabled?', ':key'].includes(key)))
        .sort(([left], [right]) => left.localeCompare(right, 'en'))
        .map(([key, child]) => [key, clean(child, depth + 1)]))
    }
    return item
  }
  return JSON.stringify(clean(value))
}

export function sourceHash(source: string) {
  return createHash('sha256').update(source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()).digest('hex')
}

type EdnMap = Record<string, EdnValue>
const get = (value: unknown, key: string): unknown =>
  value && typeof value === 'object' ? (value as EdnMap)[`:${key}`] : undefined
const mapValue = (value: unknown): EdnMap =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as EdnMap) : {}
const listValue = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const textValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback
const keyword = (value: unknown, fallback = '') => textValue(value, fallback).replace(/^:/, '')
const slug = (value: string): string =>
  value.replace(/^:/, '').split('/').pop()!.toLowerCase().replace(/[^a-z0-9]+/g, '-')

function entityIndex(key: string, value: unknown): string {
  const itemKey = textValue(get(value, 'key'), key)
  return slug(itemKey)
}

function ref(index: string) {
  return { index, name: index.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), url: '' }
}

function normalizeSpell(key: string, value: unknown) {
  const spell = mapValue(value)
  const components = Object.entries(mapValue(get(spell, 'components')))
    .filter(([, enabled]) => enabled === true || (typeof enabled === 'string' && enabled.trim() !== ''))
    .map(([name]) => ({ ':verbal': 'V', ':somatic': 'S', ':material': 'M' })[name] ?? name.replace(/^:/, ''))
  const classes = Object.entries(mapValue(get(spell, 'spell-lists')))
    .filter(([, enabled]) => enabled === true)
    .map(([name]) => ref(slug(name)))
  const description = textValue(get(spell, 'description'))
  return {
    index: entityIndex(key, spell),
    name: textValue(get(spell, 'name'), key.replace(/^:/, '').replace(/-/g, ' ')),
    url: '',
    level: typeof get(spell, 'level') === 'number' ? get(spell, 'level') : 0,
    school: ref(keyword(get(spell, 'school'), 'unknown').toLowerCase()),
    casting_time: textValue(get(spell, 'casting-time')),
    range: textValue(get(spell, 'range')),
    components,
    duration: textValue(get(spell, 'duration')),
    concentration: /concentration/i.test(textValue(get(spell, 'duration'))),
    ritual: get(spell, 'ritual') === true || get(spell, 'ritual?') === true,
    desc: description ? [description] : [],
    classes,
    homebrew: true,
  }
}

function normalizeRace(key: string, value: unknown) {
  const race = mapValue(value)
  const abilities = Object.entries(mapValue(get(race, 'abilities'))).map(([ability, bonus]) => {
    const index = slug(ability).split('-').pop()!
    return { ability_score: ref(index), bonus: typeof bonus === 'number' ? bonus : 0 }
  })
  const traits = listValue(get(race, 'traits')).map((trait) => ({
    name: textValue(get(trait, 'name'), 'Racial trait'),
    description: textValue(get(trait, 'description')),
    level: typeof get(trait, 'level') === 'number' ? get(trait, 'level') : 1,
  }))
  const languages = listValue(get(race, 'languages')).map((language) =>
    typeof language === 'string' ? { index: slug(language), name: language, url: '' } : ref(slug(String(language))),
  )
  return {
    index: entityIndex(key, race),
    name: textValue(get(race, 'name'), key.replace(/^:/, '').replace(/-/g, ' ')),
    url: '',
    speed: typeof get(race, 'speed') === 'number' ? get(race, 'speed') : 30,
    ability_bonuses: abilities,
    alignment: '',
    age: '',
    size: keyword(get(race, 'size'), 'medium'),
    languages,
    language_desc: '',
    traits: traits.map((trait) => ({ index: slug(trait.name), name: trait.name, url: '' })),
    subraces: [],
    homebrew_traits: traits,
    homebrew: true,
  }
}

function normalizeClass(key: string, value: unknown) {
  const klass = mapValue(value)
  const profs = mapValue(get(klass, 'profs'))
  const saves = Object.entries(mapValue(profs[':save']))
    .filter(([, enabled]) => enabled === true)
    .map(([ability]) => ref(slug(ability).split('-').pop()!))
  const traits = listValue(get(klass, 'traits')).map((trait) => ({
    name: textValue(get(trait, 'name'), 'Class feature'),
    description: textValue(get(trait, 'description')),
    level: typeof get(trait, 'level') === 'number' ? get(trait, 'level') : 1,
  }))
  return {
    index: entityIndex(key, klass),
    name: textValue(get(klass, 'name'), key.replace(/^:/, '').replace(/-/g, ' ')),
    url: '',
    hit_die: typeof get(klass, 'hit-die') === 'number' ? get(klass, 'hit-die') : 8,
    multi_classing: {},
    proficiencies: [],
    saving_throws: saves,
    starting_equipment: [],
    subclasses: [],
    homebrew_traits: traits,
    homebrew_subclass_title: textValue(get(klass, 'subclass-title')),
    homebrew: true,
  }
}

function normalizeBackground(key: string, value: unknown) {
  const background = mapValue(value)
  return {
    index: entityIndex(key, background),
    name: textValue(get(background, 'name'), key.replace(/^:/, '').replace(/-/g, ' ')),
    url: '',
    description: textValue(get(background, 'help')),
    traits: listValue(get(background, 'traits')).map((trait) => ({
      name: textValue(get(trait, 'name'), 'Background trait'),
      description: textValue(get(trait, 'description')),
    })),
    equipment: mapValue(get(background, 'equipment')),
    homebrew: true,
  }
}

function normalizeFeat(key: string, value: unknown) {
  const feat = mapValue(value)
  return {
    index: entityIndex(key, feat),
    name: textValue(get(feat, 'name'), key.replace(/^:/, '').replace(/-/g, ' ')).trim(),
    url: '',
    description: textValue(get(feat, 'description')),
    prerequisites: get(feat, 'prereqs') ?? [],
    ability_increases: get(feat, 'ability-increases') ?? [],
    homebrew: true,
  }
}

function normalizeSubclass(key: string, value: unknown) {
  const subclass = mapValue(value)
  return {
    index: entityIndex(key, subclass),
    name: textValue(get(subclass, 'name'), key.replace(/^:/, '').replace(/-/g, ' ')),
    url: '',
    class: keyword(get(subclass, 'class')).replace(/^.*\//, ''),
    traits: listValue(get(subclass, 'traits')).map((trait) => ({
      name: textValue(get(trait, 'name'), 'Subclass feature'),
      description: textValue(get(trait, 'description')),
      level: typeof get(trait, 'level') === 'number' ? get(trait, 'level') : 1,
    })),
    homebrew: true,
  }
}

function normalizeGeneric(key: string, value: unknown) {
  return {
    index: entityIndex(key, value),
    name: textValue(get(value, 'name'), keyword(key).replace(/-/g, ' ')).trim(),
    url: '',
    description: textValue(get(value, 'description'), textValue(get(value, 'help'))),
    details: value,
    homebrew: true,
  }
}

function normalizeSubrace(key: string, value: unknown) {
  const race = normalizeRace(key, value)
  return {
    ...race,
    race: keyword(get(value, 'race')),
    racial_traits: race.traits,
    // A subrace without its own speed inherits its parent's speed.
    speed: typeof get(value, 'speed') === 'number' ? get(value, 'speed') : undefined,
  }
}

function normalizeMonster(key: string, value: unknown) {
  const hitPoints = mapValue(get(value, 'hit-points'))
  const number = (item: unknown, fallback: number) => typeof item === 'number' && Number.isFinite(item) ? item : fallback
  const dice = number(hitPoints[':die-count'], 0)
  const die = number(hitPoints[':die'], 0)
  return {
    ...normalizeGeneric(key, value),
    size: keyword(get(value, 'size')),
    type: keyword(get(value, 'type')),
    challenge_rating: number(get(value, 'challenge'), 0),
    hit_points: Math.floor(dice * (die + 1) / 2 + number(hitPoints[':modifier'], 0)),
    hit_dice: `${dice}d${die}`,
    armor_class: get(value, 'armor-class') ?? null,
    speed: get(value, 'speed') ?? '',
    traits: get(value, 'traits') ?? [],
  }
}

const normalizers: Record<OrcbrewKind, (key: string, value: unknown) => Record<string, unknown>> = {
  spells: normalizeSpell, races: normalizeRace, classes: normalizeClass,
  backgrounds: normalizeBackground, feats: normalizeFeat, subclasses: normalizeSubclass,
  subraces: normalizeSubrace, monsters: normalizeMonster, languages: normalizeGeneric,
  invocations: normalizeGeneric, boons: normalizeGeneric, selections: normalizeGeneric, other: normalizeGeneric,
}

export function inspectOrcbrew(source: string): ParsedOrcbrew {
  let nonFiniteCount = 0
  const root = readEdn(source, () => nonFiniteCount++)
  if (!root || typeof root !== 'object' || Array.isArray(root)) throw new Error('Orcbrew content must be an EDN map')
  const entries = Object.fromEntries(ORCBREW_KINDS.map((kind) => [kind, []])) as unknown as OrcbrewEntries
  const report: OrcbrewReport = {
    packCount: 0, entryCount: 0, disabledCount: 0, duplicateCount: 0, nonFiniteCount,
    counts: Object.fromEntries(ORCBREW_KINDS.map((kind) => [kind, 0])) as Record<OrcbrewKind, number>, warnings: [],
  }
  const found = new Set<string>()
  let recognizedSections = 0

  function visit(node: EdnMap, group: string, inheritedDisabled: boolean, depth: number) {
    if (depth > 16) throw new Error('Orcbrew pack nesting exceeds 16 levels')
    const sections = Object.keys(node).filter((key) => key.startsWith(':orcpub.dnd.e5/'))
    const disabled = inheritedDisabled || node[':disabled?'] === true
    if (sections.length) report.packCount++
    for (const section of sections) {
      recognizedSections++
      const category = section.slice(':orcpub.dnd.e5/'.length)
      const kind: OrcbrewKind = ORCBREW_KINDS.includes(category as OrcbrewKind) ? category as OrcbrewKind : 'other'
      if (kind === 'other' && category !== 'other') report.warnings.push(`Section ${category} is available as reference content.`)
      const contents = node[section]
      if (!contents || typeof contents !== 'object' || Array.isArray(contents)) {
        throw new Error(`Section ${category} in ${group || 'this file'} must be an EDN map`)
      }
      for (const [key, value] of Object.entries(contents)) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw new Error(`Entry ${key} in ${category} must be an EDN map`)
        }
        const contentKey = keyword(key)
        const fingerprint = createHash('sha256').update(JSON.stringify([category, contentKey, canonicalContent(value)])).digest('hex')
        const index = `homebrew-${kind}-${fingerprint.slice(0, 32)}`
        const normalized = normalizers[kind](key, value)
        const entry: OrcbrewEntry = {
          ...normalized, name: String(normalized.name).trim(), index, contentKey,
          source: textValue(get(value, 'option-pack'), group).trim(),
          disabled: disabled || get(value, 'disabled?') === true,
          legacyKey: entityIndex(key, value),
          // Additional rule fields stay inspectable even when the sheet has no matching control.
          details: value,
          homebrew: true,
        }
        if (found.has(index)) report.duplicateCount++
        else { found.add(index); report.entryCount++; report.counts[kind]++ }
        if (entry.disabled) report.disabledCount++
        entries[kind].push(entry)
      }
    }
    for (const [name, child] of Object.entries(node)) {
      if (name.startsWith(':') || !child || typeof child !== 'object' || Array.isArray(child)) continue
      visit(child, group ? `${group} / ${name}` : name, disabled, depth + 1)
    }
  }
  visit(root, '', false, 0)
  if (!recognizedSections) throw new Error('No Orcbrew content sections were found')
  if (nonFiniteCount) report.warnings.push(`${nonFiniteCount} non-finite numeric values are shown as unspecified; their source text is preserved.`)
  report.warnings = [...new Set(report.warnings)]
  return { entries, report }
}

export function parseOrcbrew(source: string): OrcbrewEntries {
  return inspectOrcbrew(source).entries
}

export interface CatalogPack {
  id: string
  filename: string
  parsed: ParsedOrcbrew
  includeDisabled?: boolean
}

export function buildOrcbrewCatalog(packs: CatalogPack[]): OrcbrewEntries {
  const output = Object.fromEntries(ORCBREW_KINDS.map((kind) => [kind, []])) as unknown as OrcbrewEntries
  for (const kind of ORCBREW_KINDS) {
    const unique = new Map<string, OrcbrewEntry>()
    for (const pack of [...packs].sort((left, right) => left.id.localeCompare(right.id, 'en'))) {
      for (const item of pack.parsed.entries[kind]) {
        if (item.disabled && !pack.includeDisabled) continue
        const source = item.source || pack.filename
        const alias = `homebrew-${pack.id}-${item.legacyKey}`
        const previous = unique.get(item.index)
        if (previous) {
          previous.sources = [...new Set([...(previous.sources as string[]), source])].sort()
          previous.sourcePacks = [...new Set([...(previous.sourcePacks as string[]), pack.filename])].sort()
          previous.aliases = [...new Set([...(previous.aliases as string[]), alias])].sort()
        } else {
          unique.set(item.index, {
            ...item, sources: [source], sourcePacks: [pack.filename], aliases: [alias], sourcePack: source,
          })
        }
      }
    }
    const items = [...unique.values()].sort((left, right) => left.index.localeCompare(right.index, 'en'))
    const aliasOwners = new Map<string, Set<string>>()
    for (const item of items) {
      for (const alias of item.aliases as string[]) {
        const owners = aliasOwners.get(alias) ?? new Set<string>()
        owners.add(item.index)
        aliasOwners.set(alias, owners)
      }
    }
    for (const item of items) item.aliases = (item.aliases as string[]).filter((alias) => aliasOwners.get(alias)?.size === 1)
    const names = new Map<string, OrcbrewEntry[]>()
    for (const item of items) {
      const sources = item.sources as string[]
      item.sourcePack = sources.join(', ')
      const sourceLabel = sources.length > 1 ? `${sources[0]} + ${sources.length - 1} sources` : sources[0]
      const label = `${item.name} — ${sourceLabel}`
      const siblings = names.get(label) ?? []
      siblings.push(item)
      names.set(label, siblings)
    }
    for (const [label, siblings] of names) {
      siblings.forEach((item, index) => { item.displayName = siblings.length > 1 ? `${label} (version ${index + 1})` : label })
    }
    output[kind] = items.sort((left, right) => String(left.displayName).localeCompare(String(right.displayName), 'en'))
  }
  return output
}


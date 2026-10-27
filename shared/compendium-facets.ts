/** Search metadata only. These helpers never change a rule or a saved character. */
import { readMonsterExtensions } from './monster-extensions'
import sourceNames from './compendium-source-names.json'
export type FacetValues = Record<string, string[]>
export interface FacetDefinition { key: string; label: string; any: string; numeric?: boolean }
export interface FacetOption { value: string; label: string }
export interface AvailableFacet extends FacetDefinition { options: FacetOption[] }
type Row = Record<string, unknown>
const row = (v: unknown): Row => v && typeof v === 'object' && !Array.isArray(v) ? v as Row : {}
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : []
const get = (v: unknown, key: string) => row(v)[key] ?? row(v)[`:${key}`]
const keyOf = (v: unknown): string => {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'string') return v.trim().replace(/^:/, '').split('/').pop()!.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[ _]+/g, '-')
  const reference = get(v, 'index') ?? get(v, 'name')
  return typeof reference === 'string' || typeof reference === 'number' ? keyOf(reference) : ''
}
const keys = (v: unknown) => list(v).map(keyOf).filter(Boolean)
const enabled = (v: unknown) => Object.entries(row(v)).filter(([, value]) => value === true).map(([key]) => keyOf(key))
const text = (v: unknown): string => typeof v === 'string' ? v.trim() : list(v).map(text).filter(Boolean).join('\n')
const present = (v: unknown): boolean => Array.isArray(v) ? v.some(present) : typeof v === 'object' && v !== null ? Object.values(row(v)).some(present) : v !== undefined && v !== null && v !== '' && v !== false
const definition = (key: string, label: string, any = `Any ${label.toLowerCase()}`, numeric = false): FacetDefinition => ({ key, label, any, numeric })
const byKind: Record<string, FacetDefinition[]> = {
  spells: [definition('level', 'Spell level', 'Any spell level', true), definition('school', 'School'), definition('class', 'Spell list'), definition('casting', 'Casting time'), definition('concentration', 'Concentration', 'Either'), definition('ritual', 'Ritual', 'Either')],
  monsters: [definition('type', 'Creature type'), definition('size', 'Size'), definition('crMin', 'Minimum CR', 'No minimum', true), definition('crMax', 'Maximum CR', 'No maximum', true), definition('movement', 'Movement')],
  classes: [definition('hitDie', 'Hit die', 'Any hit die', true), definition('save', 'Saving throw proficiency'), definition('castingAbility', 'Spellcasting ability')],
  races: [definition('size', 'Size'), definition('speed', 'Walking speed', 'Any walking speed', true), definition('ability', 'Ability bonus'), definition('language', 'Language')],
  subraces: [definition('parentRace', 'Parent race'), definition('ability', 'Ability bonus'), definition('language', 'Language')],
  subclasses: [definition('parentClass', 'Parent class')],
  backgrounds: [definition('skill', 'Skill proficiency'), definition('tool', 'Tool proficiency')],
  feats: [definition('prerequisite', 'Prerequisites', 'Any prerequisites'), definition('ability', 'Ability increase')],
  languages: [definition('languageType', 'Language type'), definition('script', 'Script')],
  invocations: [definition('prerequisite', 'Prerequisites', 'Any prerequisites'), definition('requiredLevel', 'Required level', 'Any required level', true), definition('pact', 'Pact requirement')],
  boons: [definition('pact', 'Pact'), definition('description', 'Description', 'With or without description')],
  selections: [definition('choices', 'Available options', 'Any number of options'), definition('optionType', 'Option type'), definition('description', 'Description', 'With or without description')],
  other: [definition('optionType', 'Reference type'), definition('description', 'Description', 'With or without description')],
}
export const commonFacetDefinitions = [definition('origin', 'Library', 'All libraries'), definition('source', 'Source', 'All sources')]
export const categoryFacetDefinitions = (kind: string) => byKind[kind] ?? []

export function compendiumFacets(value: unknown, kind: string): FacetValues {
  const entry = row(value), raw = row(entry.details), workshop = row(entry.workshop), race = row(workshop.race)
  const imported = entry.homebrew === true || !!entry.sourcePack
  const read = (key: string) => entry[key] ?? get(raw, key)
  const facts: FacetValues = {}
  const add = (key: string, values: unknown[]) => { facts[key] = [...new Set(values.map(keyOf).filter(Boolean))] }
  if (entry.filterFacets) Object.assign(facts, entry.filterFacets)
  else {
    if (kind === 'spells') {
      add('level', [imported ? get(raw, 'level') : read('level')])
      add('school', [read('school')])
      add('class', keys(read('classes')))
      const casting = text(read('casting_time') ?? get(raw, 'casting-time')).toLowerCase()
      add('casting', [!casting ? '' : /bonus/.test(casting) ? 'bonus-action' : /reaction/.test(casting) ? 'reaction' : /minute/.test(casting) ? 'minutes' : /hour/.test(casting) ? 'hours' : /action/.test(casting) ? 'action' : 'other'])
      add('concentration', [typeof read('concentration') === 'boolean' && (!imported || text(get(raw, 'duration'))) ? read('concentration') ? 'yes' : 'no' : ''])
      add('ritual', [typeof read('ritual') === 'boolean' ? read('ritual') ? 'yes' : 'no' : ''])
    }
    if (kind === 'monsters') {
      const extended=readMonsterExtensions(get(raw,'codex/extended'))
      add('type', [read('type')]); add('size', extended.sizes?.length?extended.sizes:[read('size')])
      const challenge = imported ? get(raw, 'challenge') ?? get(raw, 'challenge_rating') : read('challenge_rating')
      const cr = typeof challenge === 'number' ? challenge : typeof challenge === 'string' && /^\d+(?:\.\d+|\/\d+)?$/.test(challenge) ? challenge.includes('/') ? Number(challenge.split('/')[0]) / Number(challenge.split('/')[1]) : Number(challenge) : undefined
      add('crMin', [cr]); add('crMax', [cr])
      const speed = read('speed'), movement: string[] = []
      for (const mode of ['walk', 'fly', 'swim', 'climb', 'burrow']) {
        const amount = get(speed, mode)
        if (typeof amount === 'number' && amount > 0 || typeof amount === 'string' && parseFloat(amount) > 0 || typeof speed === 'string' && new RegExp(`\\b${mode}\\b\\s*\\d+`).test(speed.toLowerCase())) movement.push(mode)
      }
      if (typeof speed === 'number' && speed > 0 || typeof speed === 'string' && /^\d+/.test(speed)) movement.push('walk')
      add('movement', movement)
    }
    if (kind === 'classes') {
      add('hitDie', [workshop.hitDie ?? (imported ? get(raw, 'hit-die') : read('hit_die'))])
      add('save', workshop.savingThrows ? keys(workshop.savingThrows) : keys(read('saving_throws')))
      const magic = row(workshop.magic), casting = get(raw, 'spellcasting')
      add('castingAbility', [magic.enabled === true ? magic.ability : magic.enabled === false ? 'none' : get(read('spellcasting'), 'spellcasting_ability') ?? get(casting, 'ability') ?? (!imported || !casting ? 'none' : '')])
    }
    if (kind === 'races' || kind === 'subraces') {
      add('size', [race.size ?? (imported ? get(raw, 'size') : read('size'))])
      add('speed', [race.speed ?? (imported ? get(raw, 'speed') : read('speed'))])
      add('ability', race.abilityBonuses ? Object.entries(row(race.abilityBonuses)).filter(([, n]) => Number(n) > 0).map(([key]) => key) : list(read('ability_bonuses')).filter(b => Number(get(b, 'bonus')) > 0).map(b => get(b, 'ability_score')))
      add('language', race.languages ? keys(race.languages) : keys(read('languages')))
      add('parentRace', [read('race')])
    }
    if (kind === 'subclasses') add('parentClass', [workshop.parentClass ?? read('class')])
    if (kind === 'backgrounds') {
      const profs = list(read('starting_proficiencies'))
      add('skill', [...profs.filter(p => keyOf(p).startsWith('skill-')).map(p => keyOf(p).slice(6)), ...enabled(get(get(raw, 'profs'), 'skill'))])
      add('tool', [...profs.filter(p => !keyOf(p).startsWith('skill-')).map(keyOf), ...enabled(get(get(raw, 'profs'), 'tool'))])
    }
    if (kind === 'feats' || kind === 'invocations') {
      const prerequisite = read('prerequisites') ?? get(raw, 'prereqs'), name = String(entry.name ?? ''), named = name.match(/\b(?:requires?|prerequisite)s?\s*:\s*([^)]*)/i)?.[1]
      add('prerequisite', [present(prerequisite) || present(get(raw, 'path-prereqs')) || named ? 'yes' : prerequisite !== undefined ? 'no' : ''])
      if (kind === 'feats') add('ability', list(read('ability_increases')).map(v => typeof v === 'string' ? v : get(v, 'ability') ?? get(v, 'ability_score')))
      if (kind === 'invocations') {
        add('requiredLevel', [named?.match(/\b(\d+)(?:st|nd|rd|th)?\s+level\b/i)?.[1] ?? get(raw, 'level')])
        add('pact', [named?.match(/pact of the (blade|chain|tome|talisman)/i)?.[1]])
      }
    }
    if (kind === 'languages') { add('languageType', [read('type')]); add('script', [read('script')]) }
    if (['boons', 'selections', 'other'].includes(kind)) {
      add('optionType', [read('type') ?? get(raw, 'option-type')])
      const options=list(read('options'))
      add('description', [text(read('description') ?? read('desc') ?? get(raw, 'help')) || options.some(option=>text(get(option,'description')??get(option,'desc'))) ? 'yes' : 'no'])
      if(kind==='selections') add('choices',[Array.isArray(read('options')) ? options.length<=5?'small':options.length<=10?'medium':options.length<=20?'large':'extensive' : ''])
      if(kind==='boons') add('pact',[String(entry.name??'').match(/\bpact of the (blade|chain|tome|talisman)/i)?.[1]])
    }
  }
  // Source names remain intact so different books/packs cannot collapse into one key.
  facts.origin = [entry.itemReference ? 'imported' : entry.workshop || entry.workshopItem ? 'workshop' : imported ? 'imported' : 'srd']
  facts.source = [...new Set(list(entry.sources).filter((v): v is string => typeof v === 'string'))]
  if (!facts.source.length) facts.source = [String(entry.sourcePack || (imported ? 'Imported content' : 'SRD 2014'))]
  return facts
}

const names: Record<string, string> = { srd:'Standard rules (SRD)', imported:'Imported content', workshop:'My Workshop', str:'Strength', dex:'Dexterity', con:'Constitution', int:'Intelligence', wis:'Wisdom', cha:'Charisma', yes:'Yes', no:'No', none:'None', walk:'Walking', fly:'Flying', swim:'Swimming', climb:'Climbing', burrow:'Burrowing', 'bonus-action':'Bonus action' }
export function facetLabel(key: string, value: string): string {
  if (value === '__unknown') return 'Not recorded'
  if (key === 'source') return Object.hasOwn(sourceNames,value) ? (sourceNames as Record<string,string>)[value]! : value
  if (key === 'level') return value === '0' ? 'Cantrip' : `Level ${value}`
  if (key === 'hitDie') return `d${value}`
  if (key === 'speed') return `${value} ft.`
  if (key === 'crMin' || key === 'crMax') return ({'0.125':'1/8','0.25':'1/4','0.5':'1/2'}[value] ?? value)
  if (key === 'prerequisite') return value === 'yes' ? 'Has prerequisites' : 'No prerequisites'
  if (key === 'description') return value === 'yes' ? 'With description' : 'Missing description'
  if (key === 'choices') return ({small:'Up to 5 options',medium:'6–10 options',large:'11–20 options',extensive:'21+ options'}[value]??value)
  if (key === 'ritual') return value === 'yes' ? 'Ritual spells' : 'Not a ritual'
  if (key === 'concentration') return value === 'yes' ? 'Requires concentration' : 'No concentration'
  return names[value] ?? value.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
export function availableFacets(definitions: FacetDefinition[], entries: FacetValues[]): AvailableFacet[] {
  return definitions.flatMap(def => {
    const values = [...new Set(entries.flatMap(entry => entry[def.key] ?? []))]
    if (!values.length) return []
    values.sort((a,b) => def.numeric ? Number(a)-Number(b) : facetLabel(def.key,a).localeCompare(facetLabel(def.key,b)))
    const options = values.map(value => ({ value, label:facetLabel(def.key,value) }))
    if (entries.some(entry => !entry[def.key]?.length) && def.key !== 'crMin' && def.key !== 'crMax') options.push({ value:'__unknown', label:'Not recorded' })
    return [{ ...def, options }]
  })
}
export function matchesFacets(facts: FacetValues, selected: Record<string, string>): boolean {
  return Object.entries(selected).every(([key, value]) => {
    if (!value) return true
    const values = facts[key] ?? []
    if (value === '__unknown') return !values.length
    if (key === 'crMin' || key === 'crMax') return values.length > 0 && values.some(v => key === 'crMin' ? Number(v) >= Number(value) : Number(v) <= Number(value))
    return values.includes(value)
  })
}

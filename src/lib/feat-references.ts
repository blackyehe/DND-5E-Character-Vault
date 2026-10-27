import type { CharacterFeature } from '../../shared/character'

// This module is also used by the server's scoped references endpoint. Keep its
// data contract independent of browser API modules and their fetch typings.
interface FeatDefinition {
  index: string
  name: string
  displayName?: string
  contentKey?: string
  description: string
  sourcePack?: string
  prerequisites: unknown
  ability_increases: unknown
}

/** Split imported feat lists without breaking commas inside prerequisites/choices. */
export function featNames(text: string): string[] {
  const names: string[] = []
  let current = '', depth = 0
  for (const char of text) {
    if (char === '(' || char === '[') depth++
    if (char === ')' || char === ']') depth = Math.max(0, depth - 1)
    if ((char === ',' || char === ';' || char === '\n') && depth === 0) { names.push(current); current = '' }
    else current += char
  }
  names.push(current)
  return [...new Set(names.map(name => name.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean))]
}
export const featNameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

export const isFeatList = (feature: Pick<CharacterFeature, 'name'>) => /^feats?$/i.test(feature.name.trim())

/** Keep saved indices intact for pin/reorder actions, excluding duplicate legacy names. */
export function sheetFeatFeatures(features: CharacterFeature[]) {
  const individual = new Set(features.filter(f => f.origin === 'feat' && !isFeatList(f)).map(f => featNameKey(f.name)))
  return features.map((feature, index) => isFeatList(feature)
    ? { ...feature, index, description: featNames(feature.description).filter(name => !individual.has(featNameKey(name))).join(', ') }
    : { ...feature, index }).filter(feature => !isFeatList(feature) || feature.description.trim())
}

export interface FeatVersion {
  id: string
  name: string
  description: string
  sources: string[]
  abilities: string[]
  prerequisites: string[]
}

/** Distinct rule versions require a source choice; duplicate imports do not. */
export function featVersions(name: string, catalog: FeatDefinition[], features: CharacterFeature[] = []): FeatVersion[] {
  const wanted = featNameKey(name), result: FeatVersion[] = []
  const matches = catalog.filter(feat => [feat.name, feat.displayName ?? '', (feat.contentKey ?? '').replace(/^.*\//, '')].some(alias => featNameKey(alias) === wanted))
  for (const [index, feat] of matches.entries()) {
    const description = feat.description.trim(), abilities = featTerms(feat.ability_increases), prerequisites = featTerms(feat.prerequisites)
    const same = result.find(entry => entry.description.replace(/\s+/g, ' ') === description.replace(/\s+/g, ' ') && JSON.stringify(entry.abilities) === JSON.stringify(abilities) && JSON.stringify(entry.prerequisites) === JSON.stringify(prerequisites))
    if (same) { if (feat.sourcePack && !same.sources.includes(feat.sourcePack)) same.sources.push(feat.sourcePack) }
    else result.push({ id: `${feat.index}:${index}`, name: feat.name, description, sources: feat.sourcePack ? [feat.sourcePack] : [], abilities, prerequisites })
  }
  if (!result.length) for (const [index, feature] of features.entries()) {
    if (!isFeatList(feature) && featNameKey(feature.name) === wanted && feature.description.trim() && !result.some(entry => entry.description === feature.description)) {
      result.push({ id: `saved-${index}`, name: feature.name, description: feature.description, sources: ['Saved character feature'], abilities: [], prerequisites: [] })
    }
  }
  return result
}

/** Display-only rows retain their source index; never write these back to a sheet. */
export function featFeatureRows(features: CharacterFeature[]) {
  const individual = new Set(features.filter(f => f.origin === 'feat' && !isFeatList(f)).map(f => featNameKey(f.name)))
  const seen = new Set<string>()
  return features.flatMap((feature, index) => {
    if (!isFeatList(feature)) return [{ ...feature, index, key: `feature:${feature._id ?? index}` }]
    return featNames(feature.description).flatMap(name => {
      const key = featNameKey(name)
      if (individual.has(key) || seen.has(key)) return []
      seen.add(key)
      return [{ ...feature, name, description: '', origin: 'feat' as const, index, key: `feat:${index}:${key}` }]
    })
  })
}

export function featTerms(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const abilities: Record<string,string> = { str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma' }
  return [...new Set(value.flatMap(entry => {
    const raw = typeof entry === 'string' ? entry : entry && typeof entry === 'object' ? String((entry as Record<string,unknown>).name ?? (entry as Record<string,unknown>)[':name'] ?? '') : ''
    if (!raw) return []
    const local=raw.replace(/^:/,'').replace(/^.*\//,'')
    return [abilities[local] ?? local.replace(/-/g,' ').replace(/^./,char=>char.toUpperCase())]
  }))]
}

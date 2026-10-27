// Discovery only. These tags never grant effects or establish prerequisites.
export const featEffects = [
  { id: 'ability', name: 'Ability bonuses' },
  { id: 'attack', name: 'Attacks & damage' },
  { id: 'defense', name: 'Defense & hit points' },
  { id: 'magic', name: 'Spellcasting' },
  { id: 'training', name: 'Skills & proficiencies' },
  { id: 'movement', name: 'Movement & utility' },
  { id: 'other', name: 'Uncategorised' },
] as const
export type FeatEffect = (typeof featEffects)[number]['id']
export interface DiscoverableFeat {
  index: string
  name: string
  description: string
  sourcePack?: string
  ability_increases?: unknown[]
}
const cues: Record<Exclude<FeatEffect, 'other'>, RegExp> = {
  ability: /\b(?:increase|increases|increased|raise)\b[^.!?\n]{0,100}\b(?:strength|dexterity|constitution|intelligence|wisdom|charisma|ability score)\b|\b(?:strength|dexterity|constitution|intelligence|wisdom|charisma|ability score)\b[^.!?\n]{0,60}\b(?:increases?|increased|raised)\b/i,
  attack: /\b(?:attack|attacks|damage|critical hit)\b/i,
  defense: /\b(?:armor class|armour class|hit points?|resistance|resistant|saving throws?|shields?)\b/i,
  magic: /\b(?:spell|spells|spellcasting|cantrip|cantrips|ritual)\b/i,
  training: /\b(?:proficiency|proficiencies|proficient|expertise|skill|skills|languages?|tools?)\b/i,
  movement: /\b(?:speed|movement|climb|climbing|swim|swimming|fly|flying|jump|jumping|teleport|initiative|darkvision|travel|carry|carrying)\b/i,
}
export function featEffectTags(feat: DiscoverableFeat): FeatEffect[] {
  const text = `${feat.name}\n${feat.description}`
  const tags = (Object.keys(cues) as Exclude<FeatEffect, 'other'>[]).filter(
    key => (key === 'ability' && !!feat.ability_increases?.length) || cues[key].test(text),
  )
  return tags.length ? tags : ['other']
}
export function findFeats<T extends DiscoverableFeat>(
  feats: readonly T[], query: string, effect: FeatEffect | '', source = '',
): T[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return feats.filter(f => {
    const text = `${f.name} ${f.description} ${f.sourcePack ?? ''}`.toLocaleLowerCase()
    return terms.every(term => text.includes(term)) &&
      (!effect || featEffectTags(f).includes(effect)) &&
      (!source || f.sourcePack === source)
  }).sort((a, b) => a.name.localeCompare(b.name))
}
export function sortSpellsByLevel<T extends { level: number; name: string }>(spells: readonly T[]): T[] {
  return [...spells].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}

import type { Character, CharacterResource, SlotProgression, SpellSlots } from './character'
import { classSpellDefaults } from './class-rules'

export const SLOT_PROGRESSIONS: Record<SlotProgression, string> = {
  full: 'Full caster · wizard / sorcerer', half: 'Half caster · paladin / ranger',
  third: 'Third caster · Eldritch Knight / Arcane Trickster', pact: 'Pact magic · warlock',
}
// 2014 SRD 5.1 slot table. Half/third casters use their single-class progression.
// https://www.dndbeyond.com/sources/dnd/basic-rules-2014/customization-options#Spellcasting
const FULL = [[], [2], [3], [4,2], [4,3], [4,3,2], [4,3,3], [4,3,3,1], [4,3,3,2],
  [4,3,3,3,1], [4,3,3,3,2], [4,3,3,3,2,1], [4,3,3,3,2,1], [4,3,3,3,2,1,1],
  [4,3,3,3,2,1,1], [4,3,3,3,2,1,1,1], [4,3,3,3,2,1,1,1], [4,3,3,3,2,1,1,1,1],
  [4,3,3,3,3,1,1,1,1], [4,3,3,3,3,2,1,1,1], [4,3,3,3,3,2,2,1,1]]

export function progressionClasses(c: Pick<Character, 'meta'>) {
  if (c.meta.classLevels?.length) return c.meta.classLevels
  return c.meta.klass.includes('/') ? [] : [{ name: c.meta.klass.replace(/\s*[·(—].*$/, '').trim(), level: c.meta.level }]
}
export function progressionLevel(c: Pick<Character, 'meta'>, className?: string) {
  return className ? progressionClasses(c).find(entry => entry.name.toLowerCase() === className.toLowerCase())?.level ?? 0 : c.meta.level
}
export function slotMaximums(progression: SlotProgression, level: number): Record<string, number> {
  const l = Math.max(0, Math.min(20, Math.trunc(level) || 0))
  let row: number[] = []
  if (progression === 'full') row = FULL[l] ?? []
  if (progression === 'half' && l >= 2) row = FULL[Math.ceil(l / 2)] ?? []
  if (progression === 'third' && l >= 3) row = FULL[Math.ceil(l / 3)] ?? []
  if (progression === 'pact' && l >= 1) {
    const rank = Math.min(5, Math.ceil(l / 2))
    row = Array.from({ length: rank }, (_, i) => i === rank - 1 ? l >= 17 ? 4 : l >= 11 ? 3 : l >= 2 ? 2 : 1 : 0)
  }
  return Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`l${i+1}`, row[i] ?? 0]))
}
export function slotsFor(c: Pick<Character, 'meta' | 'spellcasting'>): Record<string, SpellSlots> {
  const rule = c.spellcasting.slotRule
  // Older Mongoose documents can contain a nested _id alongside the slot entries.
  if (!rule || rule.workshopId) return Object.fromEntries(Array.from({ length: 9 }, (_, i) => {
    const key = `l${i+1}`, saved = c.spellcasting.slots[key]
    return [key, { max: saved?.max ?? 0, used: saved?.used ?? 0, ...(saved?.recovery ? { recovery: saved.recovery } : {}) }]
  }))
  const maxima = slotMaximums(rule.progression, progressionLevel(c, rule.className))
  return Object.fromEntries(Object.entries(maxima).map(([key, max]) => [key, {
    max, used: Math.max(0, Math.min(max, c.spellcasting.slots[key]?.used ?? 0)), recovery: rule.progression === 'pact' ? 'short' : 'long',
  }]))
}
export function scaledResource(c: Pick<Character, 'meta'>, resource: CharacterResource): CharacterResource {
  if (!resource.scaling || resource.automatic) return resource
  const max = Math.max(0, Math.trunc(resource.scaling.base + resource.scaling.perLevel * progressionLevel(c, resource.scaling.className)) || 0)
  return { ...resource, max, used: Math.max(0, Math.min(max, resource.used)) }
}
export function suggestedProgression(c: Pick<Character, 'meta'>): SlotProgression | undefined {
  const entries = progressionClasses(c)
  if (entries.length !== 1) return undefined
  const custom=classSpellDefaults(entries[0]!.name)
  if(custom)return custom.progression
  const name = entries[0]!.name.toLowerCase().replace(/\s*[·(—].*$/, '').trim()
  if (['bard','cleric','druid','sorcerer','wizard'].includes(name)) return 'full'
  if (['paladin','ranger'].includes(name)) return 'half'
  if (name === 'warlock') return 'pact'
}

export function resolveCharacterProgression<T extends Pick<Character, 'meta' | 'spellcasting' | 'resources'>>(c: T): T {
  const entries=progressionClasses(c), defaults=entries.length===1?classSpellDefaults(entries[0]!.name):undefined
  const needsClassDefaults=defaults&&!c.spellcasting.slotRule&&!Object.values(c.spellcasting.slots).some(s=>s?.max>0)
  const spellcasting=needsClassDefaults?{...c.spellcasting,ability:defaults.ability,slotRule:{progression:defaults.progression,className:entries[0]!.name}}:c.spellcasting
  return { ...c, spellcasting: { ...spellcasting, slots: slotsFor({...c,spellcasting}) }, resources: c.resources?.map(r => scaledResource(c, r)) }
}

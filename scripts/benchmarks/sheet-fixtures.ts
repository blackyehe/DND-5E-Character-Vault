import { emptyCharacter, type Character } from '../../shared/character'
import type { CharacterRuleLibrary } from '../../server/lib/workshop-rules'

/** Fictional, deterministic workloads; never load accounts, packs, or a database. */
export function sheetFixtures(): Record<string, Character> {
  return Object.fromEntries([['plain', 0], ['reviewed', 12], ['heavy', 40]].map(([label, count]) => {
    const c: Character = { ...emptyCharacter(), _id: 'a'.repeat(24), updatedAt: '2026-10-27T00:00:00.000Z' }
    c.meta.name = `Benchmark ${label}`
    c.meta.level = 8; c.meta.klass = 'Wizard'; c.meta.race = 'Human'
    c.abilities.dex = 16; c.abilities.wis = 14; c.abilities.int = 18
    c.skills.perception = 'expert'; c.combat.hpMax = 40; c.combat.hpCurrent = 30
    c.spellcasting.known = ['shield']; c.spellcasting.prepared = ['shield']
    c.spellcasting.slots = { l1: { max: 4, used: 1 } }
    c.equipment = [{ _id: 'b'.repeat(24), name: 'Ward ring', index: 'ward-ring', qty: 1, weight: 0, equipped: true, notes: '', magical: true, requiresAttunement: true, attuned: true, effects: { ac: 1, saves: 1 } }]
    c.compendiumRules = []
    for (let i = 0; i < Number(count); i++) {
      const index = `benchmark-feat-${i}`, name = `Benchmark feat ${i}`
      c.features.push({ _id: i.toString(16).padStart(24, '0'), name, description: 'Fictional reviewed feature', origin: 'feat' })
      c.compendiumRules.push({ kind: 'feats', index, revision: 1, before: { index, name }, entry: { index, name, benefits: [
        { type: 'skill-expertise', value: i % 2 ? 'stealth' : 'arcana' },
        { type: 'damage-resistance', value: i % 2 ? 'fire' : 'cold' },
        { type: 'walking-speed', value: 35 + i % 3 * 5 },
        { type: 'flying-speed-equals-walking-speed', level: i % 2 ? 9 : 1 },
        { type: 'saving-throw-prof', value: 'wis' },
      ] } })
    }
    return [label, c]
  }))
}

export const emptyRuleLibrary: CharacterRuleLibrary = {
  catalog: { spells: [], feats: [], races: [], subclasses: [], classes: [], backgrounds: [] },
  rules: [], initial: {}, warnings: [],
}

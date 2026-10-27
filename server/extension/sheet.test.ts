import { describe, it, expect } from 'vitest'
import { emptyCharacter, type Character } from '../../shared/character'
import type { WorkshopLibrary } from '../lib/workshop-library'
import { expandedSheet, vitals } from './sheet'
import { sheetSkill, sheetSave, sheetInitiative } from '../../src/lib/character-sheet'
import { combatAttacks } from '../../src/lib/equipment'

const hero = (): Character => ({ ...emptyCharacter(), _id: 'a'.repeat(24), updatedAt: '2026-10-24T00:00:00Z' })
const library = { catalog: Object.fromEntries(['spells', 'feats', 'races', 'subclasses', 'classes', 'backgrounds'].map(k => [k, []])) } as unknown as WorkshopLibrary

describe('explicit extension sheet projection', () => {
  it('keeps approved spell editions character-specific and preserves unavailable references', () => {
    const c = hero(); c.spellcasting.known = ['acid-arrow', 'missing-homebrew-spell']
    c.compendiumRules = [{ kind: 'spells', index: 'acid-arrow', revision: 1, before: { index: 'acid-arrow', name: 'Acid Arrow' }, entry: { index: 'acid-arrow', name: 'Acid Arrow', desc: ['Owner approved text'], level: 2, aliases: [] } }]
    const own = expandedSheet(c, library)
    expect(own.magic.spells.find(s => s.id === 'acid-arrow')?.description).toEqual(['Owner approved text'])
    expect(own.magic.spells.find(s => s.id === 'missing-homebrew-spell')).toMatchObject({ available: false, known: true, level: null })
    const other = hero(); other.spellcasting.known = ['acid-arrow']
    expect(expandedSheet(other, library).magic.spells[0]?.description).not.toEqual(['Owner approved text'])
  })
  it('projects the same combat counters in compact vitals and expanded references', () => {
    const c = hero(); c.combat.hitDiceTotal = 5; c.combat.hitDiceUsed = 2
    c.combat.deathSavesSuccess = 1; c.combat.deathSavesFailure = 2; c.combat.inspiration = true
    expect(vitals(c).trackers).toEqual({ hitDice: { total: 5, used: 2 }, deathSaves: { successes: 1, failures: 2 } })
    expect(expandedSheet(c, library).character).toEqual(vitals(c))
    expect(vitals(c).inspiration).toBe(true)
  })
  it('marks only unique saved feature IDs as pinnable and retains read-only derived features', () => {
    const c = hero(), id = 'b'.repeat(24), derived = 'c'.repeat(24)
    c.features = [{ _id: id, name: 'Saved', description: 'Raw', pinned: true }, { _id: derived, name: 'Derived', description: 'Resolved' }, { name: 'No ID', description: '' }]
    expect(expandedSheet(c, library, [id]).features.map(f => [f.name, f.pinnable, f.pinned])).toEqual([['Saved', true, true], ['Derived', false, false], ['No ID', false, false]])
    expect(expandedSheet(c, library, [id, id]).features[0]!.pinnable).toBe(false)
    c.features.push({ ...c.features[0]! }); expect(expandedSheet(c, library, [id]).features[0]!.pinnable).toBe(false)
  })
  it('projects website-owned senses, defenses and active/locked benefit sources without raw rules', () => {
    const c = hero(); c.meta.level = 5; c.spellcasting.known = ['trial-senses', 'inactive-spell']; c.spellcasting.activeEffects = ['trial-senses']
    c.compendiumRules = [{ kind: 'spells', index: 'trial-senses', revision: 1, before: {}, entry: { name: 'Trial senses', privateMetadata: 'PRIVATE RAW RULE', benefits: [{ type: 'condition-immunity', value: 'charmed' }, { type: 'saving-throw-advantage', value: 'poisoned' }, { type: 'darkvision', value: 90 }, { type: 'swimming-speed', value: 40 }, { type: 'num-attacks', value: 2 }, { type: 'truesight', value: 30, level: 6 }] } }, { kind: 'spells', index: 'inactive-spell', revision: 1, before: {}, entry: { name: 'Inactive spell', benefits: [{ type: 'blindsight', value: 20 }] } }]
    const projection = expandedSheet(c, library)
    expect(projection.benefits.facts).toEqual(expect.arrayContaining([{ label: 'Condition immunities', value: 'Charmed' }, { label: 'Saving throw advantage', value: 'Poisoned' }, { label: 'Darkvision', value: '90 ft.' }, { label: 'Swim', value: '40 ft.' }, { label: 'Attacks per Attack action', value: '2' }]))
    expect(projection.benefits.facts.some(f => ['Blindsight', 'Truesight'].includes(f.label))).toBe(false)
    expect(projection.benefits.sources.find(row => row.summary.includes('Truesight'))?.active).toBe(false)
    expect(projection.benefits.sources.find(row => row.source === 'Inactive spell')?.active).toBe(false)
    expect(projection.benefits.sources.find(row => row.summary.includes('Darkvision'))?.active).toBe(true)
    expect(JSON.stringify(projection)).not.toContain('PRIVATE RAW RULE')
    c.spellcasting.activeEffects = []
    expect(expandedSheet(c, library).benefits.facts).toEqual([])
  })
  it('uses ordinary website skill, save, initiative and attack helpers without exposing raw source', () => {
    const c = hero(); c.abilities.dex = 18; c.abilities.wis = 16; c.meta.level = 5; c.skills.perception = 'expert'; c.saves.dex = true
    c.equipment = [{ name: 'Longbow', qty: 1, weight: 2, equipped: true, notes: 'Saved gear', weapon: { dice: '1d8', damageType: 'piercing', range: '150/600 ft.', ranged: true, finesse: false } }]
    c.externalImport = { provider: 'dmv', source: 'PRIVATE RAW IMPORT', sourceUrl: '', warnings: [], importedAt: '' }
    c.personality.notes = 'Approved character notes'
    const projected = expandedSheet(c, library)
    expect(projected.statistics.skills.find(s => s.key === 'perception')?.modifier).toBe(sheetSkill(c, 'perception'))
    expect(projected.statistics.abilities.find(a => a.key === 'dex')?.save).toBe(sheetSave(c, 'dex'))
    expect(projected.statistics.initiative).toBe(sheetInitiative(c))
    expect(projected.attacks[0]?.toHit).toBe(combatAttacks(c)[0]?.toHit)
    expect(projected.inventory.weight).toBe(2)
    expect(projected.biography.notes).toBe('Approved character notes')
    expect(JSON.stringify(projected)).not.toContain('PRIVATE RAW IMPORT')
    expect(projected).not.toHaveProperty('compendiumRules')
  })
})

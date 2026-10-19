import { describe, expect, it } from 'vitest'
import { abilityProblem, abilityTotals, armorClass, builderIssues, composeCharacter, newBuilderDraft, restoreBuilderDraft, type BuilderContext } from './character-builder'

function context(): BuilderContext {
  return {
    race: { index: 'elf', name: 'Elf', url: '', speed: 30, size: 'Medium', age: '', alignment: '', languages: [], language_desc: '', traits: [], subraces: [], ability_bonuses: [{ ability_score: { index: 'dex', name: 'DEX', url: '' }, bonus: 2 }] },
    subrace: { index: 'high-elf', name: 'High Elf', url: '', racial_traits: [], ability_bonuses: [{ ability_score: { index: 'int', name: 'INT', url: '' }, bonus: 1 }] },
    klass: { index: 'wizard', name: 'Wizard', url: '', hit_die: 6, saving_throws: [{ index: 'int', name: 'INT', url: '' }, { index: 'wis', name: 'WIS', url: '' }], proficiencies: [], starting_equipment: [], multi_classing: {}, subclasses: [] },
    subclass: null, background: null, fixedSkills: ['perception'], skillChoice: { choose: 2, options: ['arcana', 'history', 'investigation'] },
    features: [{ name: 'Darkvision', description: 'See in darkness.' }, { name: 'Spellcasting', description: 'Cast your spells.' }, { name: 'Spellcasting', description: 'Cast your spells.' }, { name: 'Later feature', description: 'Available at level 5.', level: 5 }],
    proficiencies: { armor: [], weapons: ['Daggers'], tools: [], languages: ['Common', 'Elvish'] }, slots: { l1: 4, l2: 2 }, spellAbility: 'int',
  }
}
function draft() { const value = newBuilderDraft(); Object.assign(value, { name: 'Lyra', race: 'elf', subrace: 'high-elf', klass: 'wizard', level: 3, skills: ['arcana', 'investigation'] }); return value }

describe('character builder validation', () => {
  it('keeps racial, subracial, and manual bonuses separate from base scores', () => {
    const value = draft(); value.adjustments.int = 2
    expect(abilityTotals(value, context())).toMatchObject({ dex: 16, int: 15, str: 15 })
    expect(value.scores.int).toBe(12)
    expect(abilityTotals(value, { race: context().race, subrace: null }).int).toBe(14)
  })
  it('validates standard-array uniqueness, point-buy cost, integer inputs, and bounds', () => {
    const value = draft(); expect(abilityProblem(value)).toBe('')
    value.scores.str = 14; expect(abilityProblem(value)).toMatch(/exactly once/)
    value.method = 'pointBuy'; value.scores = { str: 15, dex: 15, con: 15, int: 15, wis: 15, cha: 15 }
    expect(abilityProblem(value)).toMatch(/budget/)
    value.scores.str = 16; expect(abilityProblem(value)).toMatch(/8 and 15/)
    value.method = 'manual'; value.scores.str = 3.5; expect(abilityProblem(value)).toMatch(/whole number/)
    value.scores.str = 21; expect(abilityProblem(value)).toMatch(/3 and 20/)
  })
  it('blocks missing or unavailable choices and invalid levels before creating a character', () => {
    const value = draft(), sources = context()
    value.name = ' '; value.level = 1.5; value.background = 'missing'; value.subclass = 'missing'
    sources.race = null
    const steps = builderIssues(value, sources).map((issue) => issue.step)
    expect(steps).toEqual(expect.arrayContaining(['race', 'class', 'identity', 'background']))
    expect(() => composeCharacter(value, sources)).toThrow()
  })
  it('enforces class skills independently of granted and additional proficiencies', () => {
    const value = draft(); value.skills = ['arcana']; value.additionalSkills = ['history']
    expect(builderIssues(value, context()).some((issue) => issue.step === 'skills')).toBe(true)
    value.skills.push('investigation'); expect(builderIssues(value, context())).toEqual([])
    value.skills.push('athletics'); expect(builderIssues(value, context()).some((issue) => issue.step === 'skills')).toBe(true)
  })
  it('requires distinct extra background languages and rejects invalid spell slots', () => {
    const value = draft(), sources = context()
    sources.background = { index: 'acolyte', name: 'Acolyte', url: '', description: '', skills: [], traits: [], equipment: [], languages: 2, suggestions: {} }
    value.extraLanguages = ['Common', 'Draconic', 'Draconic']
    expect(builderIssues(value, sources).some((issue) => issue.message.includes('languages'))).toBe(true)
    value.extraLanguages.push('Dwarvish'); value.slotOverrides.l1 = -1
    expect(builderIssues(value, sources).some((issue) => issue.step === 'spells')).toBe(true)
  })
})

describe('character sheet handoff', () => {
  it('carries every selected section into the existing character document', () => {
    const value = draft()
    value.expertise = ['arcana']; value.additionalSkills = ['stealth']; value.extraLanguages = ['Draconic']; value.tools = 'Lute, Disguise kit'
    value.spells = [{ index: 'shield', name: 'Shield', level: 1, description: '', prepared: true }, { index: 'magic-missile', name: 'Magic Missile', level: 1, description: '', prepared: false }]
    value.equipment = [{ index: 'dagger', name: 'Dagger', qty: 2, weight: 1, equipped: true, notes: 'A gift' }]
    value.age = '104'; value.pronouns = 'she / her'; value.personality.backstory = 'A scholar on the road.'
    const character = composeCharacter(value, context())
    expect(character.meta).toMatchObject({ name: 'Lyra', race: 'Elf', subrace: 'High Elf', klass: 'Wizard', level: 3 })
    expect(character.combat).toMatchObject({ hpMax: 17, hpCurrent: 17, ac: 13, speed: 30, hitDiceTotal: 3 })
    expect(character.saves).toMatchObject({ int: true, wis: true, con: false })
    expect(character.skills).toMatchObject({ arcana: 'expert', investigation: 'prof', perception: 'prof', stealth: 'prof' })
    expect(character.spellcasting).toMatchObject({ ability: 'int', known: ['shield', 'magic-missile'], prepared: ['shield'], slots: { l1: { max: 4, used: 0 }, l2: { max: 2, used: 0 } } })
    expect(character.proficiencies.tools).toEqual(['Lute', 'Disguise kit'])
    expect(character.proficiencies.languages).toEqual(['Common', 'Elvish', 'Draconic'])
    expect(character.equipment[0]).toEqual({ name: 'Dagger', qty: 2, weight: 1, equipped: true, notes: 'A gift' })
    expect(character.features).toHaveLength(2)
    expect(character.personality.appearance).toContain('Age: 104\nPronouns: she / her')
    expect(character.personality.backstory).toBe('A scholar on the road.')
  })
  it('uses actual worn armor, Dexterity caps, a single shield bonus, and manual overrides', () => {
    const value = draft(), totals = { ...value.scores, dex: 20 }
    value.equipment = [{ index: 'ring', name: 'Ring Mail', qty: 1, weight: 40, equipped: true, notes: '', armor_class: { base: 14, dex_bonus: false } }, { index: 'shield', name: 'Shield', qty: 1, weight: 6, equipped: true, notes: '', armor_category: 'Shield', armor_class: { base: 2, dex_bonus: false } }]
    expect(armorClass(value, totals)).toBe(16)
    value.equipment[0]!.armor_class = { base: 12, dex_bonus: true, max_bonus: 2 }
    expect(armorClass(value, totals)).toBe(16)
    value.acOverride = 19; value.hpOverride = 30; value.slotOverrides.l1 = 7
    expect(composeCharacter(value, context()).combat).toMatchObject({ ac: 19, hpMax: 30 })
    expect(composeCharacter(value, context()).spellcasting.slots.l1?.max).toBe(7)
  })
  it('restores a valid local draft and ignores corrupt shapes without sharing mutable defaults', () => {
    const value = draft(); value.additionalSkills = ['stealth']
    const restored = restoreBuilderDraft(JSON.parse(JSON.stringify(value)))
    expect(restored).toEqual(value)
    expect(restoreBuilderDraft({ version: 99, name: 'Broken' }).name).toBe('')
    const bad = restoreBuilderDraft({ version: 1, skills: ['arcana', 4, 'arcana'], equipment: [{ name: 'Broken', qty: -1 }], spells: [{ index: 'bad' }], scores: { str: 'bad' } })
    expect(bad.skills).toEqual(['arcana']); expect(bad.equipment).toEqual([]); expect(bad.spells).toEqual([]); expect(bad.scores.str).toBe(15)
    restored.scores.str = 9; expect(newBuilderDraft().scores.str).toBe(15)
  })
})

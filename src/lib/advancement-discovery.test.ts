import { describe, expect, it } from 'vitest'
import { featEffectTags, findFeats, sortSpellsByLevel } from './advancement-discovery'

describe('advancement discovery', () => {
  it('sorts numeric levels before truncation, alphabetically within each level, without changing the catalog', () => {
    const spells = [...Array.from({ length: 45 }, (_, i) => ({ name: `High ${i}`, level: 9 })),
      { name: 'Z light', level: 0 }, { name: 'A light', level: 0 }, { name: 'A shield', level: 1 },
      { name: 'A gust', level: 2 }]
    expect(sortSpellsByLevel(spells).slice(0, 4).map(s => s.name)).toEqual(['A light', 'Z light', 'A shield', 'A gust'])
    expect(spells[0]!.level).toBe(9)
  })
  it('uses structured ability bonuses and supports overlapping descriptive effects', () => {
    expect(featEffectTags({ index: 'a', name: 'Gift', description: '', ability_increases: [{ ability: 'wis', amount: 1 }] })).toEqual(['ability'])
    expect(featEffectTags({ index: 'b', name: 'Gift', description: 'Increase your Strength by 1. Your attacks deal extra damage. Gain proficiency with shields, learn a cantrip, and increase your speed.' }))
      .toEqual(['ability', 'attack', 'defense', 'magic', 'training', 'movement'])
  })
  it('combines search, effect, and source without dropping unclassified or source-less feats', () => {
    const feats = [
      { index: 'b', name: 'Ward', description: 'Learn a ritual spell.', sourcePack: 'North' },
      { index: 'a', name: 'Arcane Ward', description: 'Learn a ritual spell.', sourcePack: 'South' },
      { index: 'c', name: 'Unusual gift', description: 'Consult your DM.' },
    ]
    expect(findFeats(feats, ' ritual WARD ', 'magic', 'North').map(f => f.index)).toEqual(['b'])
    expect(findFeats(feats, '', 'other').map(f => f.index)).toEqual(['c'])
    expect(findFeats(feats, 'nothing', '')).toEqual([])
    expect(findFeats(feats, '', '').map(f => f.index)).toEqual(['a', 'c', 'b'])
    expect(findFeats(feats, '', '')).toHaveLength(3)
  })
  it('recognises common imported wording without treating an ability prerequisite alone as a bonus', () => {
    expect(featEffectTags({ index: 'a', name: 'Gift', description: 'Your Dexterity score increases by 1. Your hit point maximum increases by 2.' })).toEqual(['ability', 'defense'])
    expect(featEffectTags({ index: 'b', name: 'Gift', description: 'Prerequisite: Strength 13 or higher.' })).toEqual(['other'])
  })
  it('does not hide later matching feats behind an arbitrary initial result limit', () => {
    const feats = Array.from({ length: 80 }, (_, i) => ({ index: `${i}`, name: `Feat ${i}`, description: i === 79 ? 'Learn a spell.' : 'Consult your DM.' }))
    expect(findFeats(feats, '', '')).toHaveLength(80)
    expect(findFeats(feats, '', 'magic').map(f => f.index)).toEqual(['79'])
  })
})

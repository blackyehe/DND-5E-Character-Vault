import { describe, it, expect } from 'vitest'
import {
  abilityMod,
  profBonus,
  saveMod,
  skillMod,
  passivePerception,
  initiative,
  spellAttackBonus,
  spellSaveDC,
  attackBonus,
  maxHP,
  carriedWeight,
} from './calc'

describe('abilityMod', () => {
  it('computes modifiers', () => {
    expect(abilityMod(10)).toBe(0)
    expect(abilityMod(8)).toBe(-1)
    expect(abilityMod(15)).toBe(2)
    expect(abilityMod(1)).toBe(-5)
    expect(abilityMod(20)).toBe(5)
  })
})

describe('profBonus', () => {
  it('scales with level', () => {
    expect(profBonus(1)).toBe(2)
    expect(profBonus(4)).toBe(2)
    expect(profBonus(5)).toBe(3)
    expect(profBonus(8)).toBe(3)
    expect(profBonus(9)).toBe(4)
    expect(profBonus(12)).toBe(4)
    expect(profBonus(13)).toBe(5)
    expect(profBonus(16)).toBe(5)
    expect(profBonus(17)).toBe(6)
    expect(profBonus(20)).toBe(6)
  })

  it('clamps out-of-range levels', () => {
    expect(profBonus(0)).toBe(2)
    expect(profBonus(99)).toBe(6)
  })
})

describe('saveMod', () => {
  it('adds proficiency when proficient', () => {
    expect(saveMod(1, 16, true)).toBe(2 + 3) // mod 3 + pb 2 at lvl1 = 5
    expect(saveMod(1, 16, false)).toBe(3)
  })
})

describe('skillMod', () => {
  it('handles none/prof/expert', () => {
    expect(skillMod(1, 14, 'none')).toBe(2)
    expect(skillMod(1, 14, 'prof')).toBe(4)
    expect(skillMod(1, 14, 'expert')).toBe(6)
  })
})

describe('passivePerception', () => {
  it('is 10 + skill mod', () => {
    expect(passivePerception(1, 10, 'none')).toBe(10)
    expect(passivePerception(1, 14, 'prof')).toBe(14) // 10 + 2 + 2
  })
})

describe('initiative', () => {
  it('uses dex modifier', () => {
    expect(initiative(15)).toBe(2)
    expect(initiative(8)).toBe(-1)
  })
})

describe('spellAttack / spellSaveDC', () => {
  it('are consistent', () => {
    expect(spellAttackBonus(1, 16, 'prof')).toBe(5)
    expect(spellSaveDC(1, 16, 'prof')).toBe(13) // 8 + 5
  })
})

describe('attackBonus', () => {
  it('sums ability, prof, magic', () => {
    expect(attackBonus(1, 16, true, 1)).toBe(3 + 2 + 1)
    expect(attackBonus(1, 16, false, 0)).toBe(3)
  })
})

describe('maxHP', () => {
  it('level 1 = hit die + con', () => {
    expect(maxHP(8, 14, 1)).toBe(8 + 2)
    expect(maxHP(8, 10, 1)).toBe(8)
    expect(maxHP(8, 8, 1)).toBe(8 - 1)
  })

  it('scales with level using fixed average', () => {
    // d8 fixed avg floor = 4; level 3, con +2 => 8+2 + 2*(4+2) = 10 + 12 = 22
    expect(maxHP(8, 14, 3)).toBe(8 + 2 + 2 * (4 + 2))
  })
})

describe('carriedWeight', () => {
  it('multiplies weight by qty', () => {
    expect(
      carriedWeight([
        { weight: 2, qty: 3 },
        { weight: 0.5, qty: 4 },
      ]),
    ).toBe(6 + 2)
  })
})

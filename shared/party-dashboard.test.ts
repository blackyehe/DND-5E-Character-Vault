import { describe, expect, it } from 'vitest'
import { emptyCharacter, type Character } from './character'
import { partyHitPointUpdate, partyMemberSnapshot } from './party-dashboard'

const character = (): Character => ({ ...emptyCharacter(), _id: 'hero', updatedAt: '2026-10-22T00:00:00.000Z' })

describe('party snapshots', () => {
  it('uses equipped armour, expertise, class slot progression and scaled homebrew resources', () => {
    const c = character()
    c.meta.level = 8; c.meta.klass = 'Wizard / Fighter'
    c.meta.classLevels = [{ name: 'Wizard', level: 5 }, { name: 'Fighter', level: 3 }]
    c.abilities.dex = 18; c.abilities.wis = 16; c.abilities.int = 18
    c.skills.perception = 'expert'; c.combat.acMode = 'equipment'
    c.equipment = [
      { name: 'Half plate', qty: 1, weight: 40, equipped: true, notes: '', armor: { base: 15, dex: true, cap: 2, shield: false } },
      { name: 'Shield +1', qty: 1, weight: 6, equipped: true, notes: '', magicBonus: 1, armor: { base: 2, dex: false, shield: true } },
      { name: 'Unequipped armour', qty: 1, weight: 0, equipped: false, notes: '', armor: { base: 30, dex: false, shield: false } },
    ]
    c.spellcasting.slotRule = { progression: 'full', className: 'Wizard' }
    c.spellcasting.slots = { l3: { max: 99, used: 1 } }
    c.resources = [{ id: 'ward', name: 'Ward', max: 0, used: 3, recovery: 'short', scaling: { base: 2, perLevel: 1, className: 'Wizard' } }]
    const snapshot = partyMemberSnapshot(c)
    expect(snapshot).toMatchObject({ ac: 20, perception: 19, saveDC: 15, speed: 30 })
    expect(snapshot.slots).toEqual([{ key: 'l1', max: 4, used: 0, recovery: 'long' }, { key: 'l2', max: 3, used: 0, recovery: 'long' }, { key: 'l3', max: 2, used: 1, recovery: 'long' }])
    expect(snapshot.resources.find(r => r.id === 'ward')).toMatchObject({ max: 7, used: 3 })
    expect(snapshot.resources.find(r => r.id === 'auto:action-surge')).toMatchObject({ max: 1, recovery: 'short' })
  })

  it('does not invent casting, conditions or concentration for noncasters', () => {
    const snapshot = partyMemberSnapshot(character())
    expect(snapshot.saveDC).toBeUndefined()
    expect(snapshot.slots).toEqual([])
    expect(snapshot).not.toHaveProperty('conditions')
    expect(snapshot).not.toHaveProperty('concentration')
    expect(snapshot).not.toHaveProperty('personality')
  })

  it('preserves unlimited resources and saved usage of automatic resources', () => {
    const c = character(); c.meta.klass = 'Barbarian'; c.meta.level = 20
    c.resources = [{ id: 'auto:rage', name: 'Rage', max: 6, used: 2, automatic: true, recovery: 'long' }]
    expect(partyMemberSnapshot(c).resources).toContainEqual(expect.objectContaining({ id: 'auto:rage', unlimited: true, used: 2 }))
  })
})

describe('party hit point actions', () => {
  const member = () => { const c = character(); c.combat.hpCurrent = 8; c.combat.hpMax = 20; c.combat.hpTemp = 5; return partyMemberSnapshot(c) }
  it('absorbs damage with temporary HP and carries the saved timestamp', () => {
    const before = member()
    expect(partyHitPointUpdate(before, 3, false)).toEqual({ expectedUpdatedAt: before.updatedAt, combat: { hpCurrent: 8, hpTemp: 2 } })
    expect(partyHitPointUpdate(before, 9, false)?.combat).toEqual({ hpCurrent: 4, hpTemp: 0 })
    expect(before.hp).toEqual({ current: 8, max: 20, temp: 5 })
  })
  it('bounds overkill at zero and healing at maximum without changing temporary HP', () => {
    expect(partyHitPointUpdate(member(), 100, false)?.combat).toEqual({ hpCurrent: 0, hpTemp: 0 })
    expect(partyHitPointUpdate(member(), 100, true)?.combat).toEqual({ hpCurrent: 20 })
  })
  it.each([0, -1, 1.5, NaN, Infinity, 10000])('rejects invalid damage/healing amounts: %s', amount => {
    expect(partyHitPointUpdate(member(), amount, false)).toBeNull()
  })
})

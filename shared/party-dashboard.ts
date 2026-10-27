import type { Character, CharacterResource, SpellSlots } from './character'
import type { PlayUpdate } from './rooms'
import { characterBenefits, benefitDamage, benefitSpellDC } from './rule-benefits'
import { sheetPassive } from '../src/lib/character-sheet'
import { resourcesFor, sheetAC } from '../src/lib/character-sheet'
import { slotsFor } from './character-progression'
import { innateRaceSpells } from './workshop-race'

/** Small, saved-sheet snapshot. No biography, imports, rule catalogs, or full sheets. */
export interface PartyMemberSnapshot {
  id: string
  updatedAt: string
  hp: { current: number; max: number; temp: number }
  ac: number
  perception: number
  speed: number
  inspiration: boolean
  saveDC?: number
  defenses?: {resistances:string[];immunities:string[];vulnerabilities:string[]}
  slots: (SpellSlots & { key: string })[]
  resources: CharacterResource[]
}

export function partyMemberSnapshot(c: Character): PartyMemberSnapshot {
  const slots = Object.entries(slotsFor(c)).filter(([, slot]) => slot.max > 0).map(([key, slot]) => ({ key, ...slot }))
  const hasMagic = slots.length || c.spellcasting.known.length || c.spellcasting.prepared.length || innateRaceSpells(c).length
  return {
    id: String(c._id), updatedAt: new Date(c.updatedAt).toISOString(),
    hp: { current: c.combat.hpCurrent, max: c.combat.hpMax, temp: c.combat.hpTemp },
    ac: sheetAC(c), perception: sheetPassive(c),
    inspiration: c.combat.inspiration, speed: characterBenefits(c).speed, defenses:{resistances:characterBenefits(c).resistances,immunities:characterBenefits(c).immunities,vulnerabilities:characterBenefits(c).vulnerabilities},
    ...(hasMagic ? { saveDC: benefitSpellDC(c) } : {}),
    slots, resources: resourcesFor(c).filter(r => r.max > 0 || r.unlimited),
  }
}

export function partyHitPointUpdate(member: PartyMemberSnapshot, amount: number, heal: boolean, damageType=''): PlayUpdate | null {
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 9999) return null
  if(!heal)amount=benefitDamage(amount,damageType,member.defenses??{resistances:[],immunities:[],vulnerabilities:[]})
  const { current, max, temp } = member.hp
  const absorbed = heal ? 0 : Math.min(temp, amount)
  return { expectedUpdatedAt: member.updatedAt, combat: heal
    ? { hpCurrent: Math.min(max, current + amount) }
    : { hpCurrent: Math.max(0, current - amount + absorbed), hpTemp: temp - absorbed } }
}

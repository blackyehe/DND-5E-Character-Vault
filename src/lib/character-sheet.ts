import type { Attack, Character, CharacterFeature } from '../../shared/character'
import { abilityMod, attackBonus, skillMod, saveMod } from './calc'
import { characterBenefits, benefitSpellAttack, benefitSpellDC, type CharacterBenefits } from '../../shared/rule-benefits'
export { benefitSpellAttack, benefitSpellDC }
// Callers calculating a group of statistics can share one current snapshot.
// Existing callers still calculate fresh benefits; nothing is cached by identity.
export const sheetSkill=(c:Character,key:string,benefits:CharacterBenefits=characterBenefits(c))=>skillMod(c.meta.level,c.abilities[SKILL_ABILITY[key]!],benefits.skills[key]??'none')
export const sheetSave=(c:Character,key:AbilityKey,benefits:CharacterBenefits=characterBenefits(c))=>saveMod(c.meta.level,c.abilities[key],benefits.saves[key])+itemBonuses(c).saves+benefits.saveBonus
export const sheetInitiative=(c:Character,benefits:CharacterBenefits=characterBenefits(c))=>abilityMod(c.abilities.dex)+benefits.initiative
export const sheetPassive=(c:Character,benefits:CharacterBenefits=characterBenefits(c))=>10+sheetSkill(c,'perception',benefits)
import { SKILL_ABILITY,type AbilityKey } from './calc'
import { itemBonuses, itemActive } from '../../shared/item-rules'
import { compactWeaponProficiencies } from '../../shared/weapon-proficiencies'
export { equipmentFrom } from '../../shared/equipment-definitions'

export const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000]
export const signed = (n: number) => n >= 0 ? `+${n}` : String(n)
export const pretty = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/-/g, ' ').replace(/^./, c => c.toUpperCase())
export const ORIGINS = { racial: 'Racial traits', class: 'Class features', subclass: 'Subclass features', background: 'Background', feat: 'Feats', other: 'Other / unclassified' } as const
export function sheetProficiencies(c: Character, benefits:CharacterBenefits=characterBenefits(c)) {
  const p=benefits.proficiencies;return { ...p, weapons: compactWeaponProficiencies(p.weapons) }
}
export { classes, automaticResources, resourcesFor } from '../../shared/character-resources'
export function sheetAC(c: Character, benefits:CharacterBenefits=characterBenefits(c)) {
  const bonus=itemBonuses(c).ac, ruleBonus=benefits.ac
  if (c.combat.acMode !== 'equipment') return c.combat.ac + bonus - (c.combat.itemAcBaseline??bonus) + ruleBonus
  let base = 10 + abilityMod(c.abilities.dex), armor = false, shield = 0
  for (const item of c.equipment.filter(i => i.equipped && i.qty > 0 && i.armor)) {
    const a = item.armor!, magic = itemActive(item) ? item.magicBonus ?? 0 : 0
    if (a.shield) shield = Math.max(shield, a.base + magic)
    else { const value = a.base + magic + (a.dex ? Math.min(abilityMod(c.abilities.dex), a.cap ?? Infinity) : 0); base = armor ? Math.max(base, value) : value; armor = true }
  }
  return base + shield + bonus + ruleBonus
}
const SIMPLE = new Set(['club', 'dagger', 'greatclub', 'handaxe', 'javelin', 'light hammer', 'mace', 'quarterstaff', 'sickle', 'spear', 'light crossbow', 'crossbow, light', 'dart', 'shortbow', 'sling'])
const MARTIAL = new Set(['battleaxe','flail','glaive','greataxe','greatsword','halberd','lance','longsword','maul','morningstar','pike','rapier','scimitar','shortsword','trident','war pick','warhammer','whip','blowgun','hand crossbow','crossbow, hand','heavy crossbow','crossbow, heavy','longbow','net'])
export function weaponProficient(c: Character, attack: Attack, weaponCategory?: string) {
  if (attack.proficient !== undefined) return attack.proficient
  const item=c.equipment.find(item=>item.name.toLowerCase()===attack.name.toLowerCase())
  const name = (item?.weapon&&item.index?item.index.replace(/-/g,' '):attack.name).toLowerCase().replace(/\s*\+\d+.*$/, '').trim()
  const category = (weaponCategory ?? item?.weapon?.category ?? '').toLowerCase()
  return characterBenefits(c).proficiencies.weapons.some(p => {
    const prof = p.toLowerCase().replace(/\s*\([^)]*\)/g, '').trim().replace(/^all\s+/, '')
    return prof === name || (prof === 'simple weapons' && (SIMPLE.has(name) || category === 'simple')) || (prof === 'martial weapons' && (MARTIAL.has(name) || category === 'martial'))
  })
}
export function attackValues(c: Character, a: Attack, weaponCategory?: string) {
  const mod = abilityMod(c.abilities[a.ability]), proficient = weaponProficient(c, a, weaponCategory)
  const damage = (a.addAbilityDamage === false ? 0 : mod) + a.damageBonus + a.magicBonus + characterBenefits(c).damageBonus
  return { proficient, toHit: attackBonus(c.meta.level, c.abilities[a.ability], proficient, a.magicBonus) + characterBenefits(c).attackBonus, damage, text: `${a.damageDice || '—'}${damage ? signed(damage) : ''}` }
}
export function combatSuggested(f: CharacterFeature) {
  // Legacy hidden flags are ignored now that Combat uses pinning for prioritisation.
  return f.pinned || f.origin === 'feat' || /^feats?$/i.test(f.name.trim()) || /\b(action|bonus action|reaction|initiative|attack|damage|combat|sorcery|metamagic|rage|second wind|channel divinity)\b/i.test(`${f.name} ${f.description}`)
}

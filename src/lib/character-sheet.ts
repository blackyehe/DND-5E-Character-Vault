import type { Attack, Character, CharacterFeature } from '../../shared/character'
import { abilityMod, attackBonus } from './calc'
import { itemBonuses, itemActive } from '../../shared/item-rules'
import { compactWeaponProficiencies } from '../../shared/weapon-proficiencies'
export { equipmentFrom } from '../../shared/equipment-definitions'

export const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000]
export const signed = (n: number) => n >= 0 ? `+${n}` : String(n)
export const pretty = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/-/g, ' ').replace(/^./, c => c.toUpperCase())
export const ORIGINS = { racial: 'Racial traits', class: 'Class features', subclass: 'Subclass features', background: 'Background', feat: 'Feats', other: 'Other / unclassified' } as const
export function sheetProficiencies(c: Character) {
  return { ...c.proficiencies, weapons: compactWeaponProficiencies(c.proficiencies.weapons) }
}
export { classes, automaticResources, resourcesFor } from '../../shared/character-resources'
export function sheetAC(c: Character) {
  const bonus=itemBonuses(c).ac
  if (c.combat.acMode !== 'equipment') return c.combat.ac + bonus - (c.combat.itemAcBaseline??bonus)
  let base = 10 + abilityMod(c.abilities.dex), armor = false, shield = 0
  for (const item of c.equipment.filter(i => i.equipped && i.qty > 0 && i.armor)) {
    const a = item.armor!, magic = itemActive(item) ? item.magicBonus ?? 0 : 0
    if (a.shield) shield = Math.max(shield, a.base + magic)
    else { const value = a.base + magic + (a.dex ? Math.min(abilityMod(c.abilities.dex), a.cap ?? Infinity) : 0); base = armor ? Math.max(base, value) : value; armor = true }
  }
  return base + shield + bonus
}
const SIMPLE = new Set(['club', 'dagger', 'greatclub', 'handaxe', 'javelin', 'light hammer', 'mace', 'quarterstaff', 'sickle', 'spear', 'light crossbow', 'crossbow, light', 'dart', 'shortbow', 'sling'])
const MARTIAL = new Set(['battleaxe','flail','glaive','greataxe','greatsword','halberd','lance','longsword','maul','morningstar','pike','rapier','scimitar','shortsword','trident','war pick','warhammer','whip','blowgun','hand crossbow','crossbow, hand','heavy crossbow','crossbow, heavy','longbow','net'])
export function weaponProficient(c: Character, attack: Attack, weaponCategory?: string) {
  if (attack.proficient !== undefined) return attack.proficient
  const item=c.equipment.find(item=>item.name.toLowerCase()===attack.name.toLowerCase())
  const name = (item?.weapon&&item.index?item.index.replace(/-/g,' '):attack.name).toLowerCase().replace(/\s*\+\d+.*$/, '').trim()
  const category = (weaponCategory ?? item?.weapon?.category ?? '').toLowerCase()
  return c.proficiencies.weapons.some(p => {
    const prof = p.toLowerCase().replace(/\s*\([^)]*\)/g, '').trim().replace(/^all\s+/, '')
    return prof === name || (prof === 'simple weapons' && (SIMPLE.has(name) || category === 'simple')) || (prof === 'martial weapons' && (MARTIAL.has(name) || category === 'martial'))
  })
}
export function attackValues(c: Character, a: Attack, weaponCategory?: string) {
  const mod = abilityMod(c.abilities[a.ability]), proficient = weaponProficient(c, a, weaponCategory)
  const damage = (a.addAbilityDamage === false ? 0 : mod) + a.damageBonus + a.magicBonus
  return { proficient, toHit: attackBonus(c.meta.level, c.abilities[a.ability], proficient, a.magicBonus), damage, text: `${a.damageDice || '—'}${damage ? signed(damage) : ''}` }
}
export function combatSuggested(f: CharacterFeature) {
  // Legacy hidden flags are ignored now that Combat uses pinning for prioritisation.
  return f.pinned || f.origin === 'feat' || /^feats?$/i.test(f.name.trim()) || /\b(action|bonus action|reaction|initiative|attack|damage|combat|sorcery|metamagic|rage|second wind|channel divinity)\b/i.test(`${f.name} ${f.description}`)
}

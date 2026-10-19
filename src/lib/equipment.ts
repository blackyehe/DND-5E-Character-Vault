import type { Attack, Character, EquipmentItem } from '../../shared/character'
import { abilityMod } from './calc'
import { attackValues, sheetAC } from './character-sheet'
import { itemActive,itemKind } from '../../shared/item-rules'

export type InventoryKind = NonNullable<EquipmentItem['kind']>
const denominations = {
  cp: ['cp', 'copper', 'copper piece', 'copper pieces', 'copper coin', 'copper coins'],
  sp: ['sp', 'silver', 'silver piece', 'silver pieces', 'silver coin', 'silver coins'],
  ep: ['ep', 'electrum', 'electrum piece', 'electrum pieces', 'electrum coin', 'electrum coins'],
  gp: ['gp', 'gold', 'gold piece', 'gold pieces', 'gold coin', 'gold coins'],
  pp: ['pp', 'platinum', 'platinum piece', 'platinum pieces', 'platinum coin', 'platinum coins'],
} as const
export function coinType(item: EquipmentItem): keyof typeof denominations | undefined {
  const name = item.name.toLowerCase().trim().replace(/[.]/g, '')
  return (Object.keys(denominations) as (keyof typeof denominations)[]).find(key => (denominations[key] as readonly string[]).includes(name))
}
const nameKey = (name: string) => name.toLowerCase().trim().replace(/\s+/g, ' ')
export function inventoryKind(item: EquipmentItem, character: Character): InventoryKind {
  if(item.kind)return item.kind
  const category = item.category?.toLowerCase() ?? ''
  if (item.weapon || /\bweapons?\b/.test(category) || character.attacks.some(a => nameKey(a.name) === nameKey(item.name))) return 'weapon'
  if (item.armor || /\b(armou?rs?|shields?)\b/.test(category) || /^shield(?:\s*\+\d+)?$/i.test(item.name)) return 'armour'
  if (coinType(item) || /\b(treasure|currency|coins?|valuables?|gems?)\b/.test(category) || /^currency\s*\/\s*treasure imported/i.test(item.notes)) return 'treasure'
  return itemKind(item)
}
export function equipmentAttacks(character: Character, item: EquipmentItem) {
  const saved = character.attacks.filter(a => nameKey(a.name) === nameKey(item.name))
  let attacks = saved
  if (!attacks.length && item.weapon) {
    const weapon = item.weapon
    const attack: Attack = {
      name: item.name, ability: weapon.ranged || weapon.finesse && character.abilities.dex > character.abilities.str ? 'dex' : 'str',
      range: weapon.range, damageDice: weapon.dice, damageType: weapon.damageType, damageBonus: 0, magicBonus: item.magicBonus ?? 0, notes: '',
    }
    attacks = [attack]
  }
  return attacks.map(attack => {const effective={...attack,magicBonus:itemActive(item)?item.magicBonus??attack.magicBonus:0};return {...effective,...attackValues(character,effective,item.weapon?.category),...(item.weapon?.noDamage?{damage:0,text:'No direct damage'}:{})}})
}
/** Inventory weapons follow equip state; independently entered attacks remain available. */
export function combatAttacks(character:Character) {
  const custom=character.attacks.filter(attack=>!character.equipment.some(item=>inventoryKind(item,character)==='weapon'&&nameKey(item.name)===nameKey(attack.name)))
    .map(attack=>({...attack,...attackValues(character,attack),item:undefined as EquipmentItem|undefined}))
  const weapons=character.equipment.filter(item=>item.equipped&&item.qty>0&&inventoryKind(item,character)==='weapon')
    .flatMap(item=>equipmentAttacks(character,item).map(attack=>({...attack,item})))
  return [...weapons,...custom]
}
export function armourValues(character: Character, item: EquipmentItem, index: number) {
  const armour = item.armor
  if (!armour) return null
  const dex = armour.dex ? Math.min(abilityMod(character.abilities.dex), armour.cap ?? Infinity) : 0
  const magic = item.requiresAttunement&&!item.attuned?0:item.magicBonus ?? 0
  const equipped = character.equipment.map((entry, i) => i === index
    ? { ...item, equipped: true, qty: Math.max(1, item.qty) }
    : entry.armor && entry.armor.shield === armour.shield ? { ...entry, equipped: false } : entry)
  return {
    base: armour.base, dex, magic, shield: armour.shield,
    itemAC: armour.base + dex + magic,
    total: sheetAC({ ...character, equipment: equipped, combat: { ...character.combat, acMode: 'equipment' } }),
    actual: sheetAC(character),
  }
}

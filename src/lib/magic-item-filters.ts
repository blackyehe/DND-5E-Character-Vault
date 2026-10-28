import data from './magic-item-filter-data.json'
import forms from './item-forms.json'
import equipmentData from './equipment-filter-data.json'
import type { EquipmentItem } from '../../shared/character'
import { equipmentCategory, equipmentTags } from '../../shared/item-classification'

interface ItemTags {
  category: string
  weaponTypes?: string[]
  armourTypes?: string[]
  bonusDamageTypes?: string[]
  replacesDamage?: boolean
  tags?: string[]
  rarity?: string
  attunement?: boolean
}
const tags = data.items as Record<string, ItemTags>
export const magicItemCategories = [
  ['weapon', 'Weapons'], ['armor', 'Armour and shields'], ['ammunition', 'Ammunition'],
  ['potion', 'Potions'], ['ring', 'Rings'], ['rod', 'Rods'], ['scroll', 'Scrolls'],
  ['staff', 'Staves'], ['wand', 'Wands'], ['wondrous-items', 'Wondrous items'],
] as const
export const magicWeaponTypes = [...forms.weapons].sort((a, b) => a.name.localeCompare(b.name))
export const magicArmourTypes = [...forms.armours].sort((a, b) => a.name.localeCompare(b.name))
export const magicDamageTypes = ['acid','bludgeoning','cold','fire','force','lightning','necrotic','piercing','poison','psychic','radiant','slashing','thunder']
export const hasMagicItemTags = (index: string) => Boolean(tags[index])
export const normalEquipmentSearch=equipmentData as Record<string,EquipmentItem>
export function magicItemBases(index:string) {
  const tag=tags[index]
  return [...magicWeaponTypes.filter(w=>tag?.weaponTypes?.includes(w.index)),...magicArmourTypes.filter(a=>tag?.armourTypes?.includes(a.index))]
}

export interface ItemSearchFilters { category:string; weapon:string; damage:string; armour:string; tag?:string; rarity?:string; attunement?:string }
export const emptyItemFilters=():ItemSearchFilters=>({category:'',weapon:'',damage:'',armour:'',tag:'',rarity:'',attunement:''})
export function matchesMagicItem(index: string, filters: ItemSearchFilters) {
  const tag = tags[index]
  if (!tag) return !Object.values(filters).some(Boolean)
  if (filters.category && tag.category !== filters.category) return false
  if (filters.tag && !tag.tags?.includes(filters.tag)) return false
  if (filters.rarity && tag.rarity!==filters.rarity) return false
  if (filters.attunement && tag.attunement!==(filters.attunement==='required'))return false
  if (filters.armour && !forms.armours.some(a=>tag.armourTypes?.includes(a.index)&&(a.index===filters.armour||`group:${a.group}`===filters.armour))) return false
  const weapons = forms.weapons.filter(w => tag.weaponTypes?.includes(w.index) && (!filters.weapon ||
    filters.weapon === w.index || filters.weapon === `group:${w.group}` || filters.weapon === `range:${w.range}`))
  if (filters.weapon && !weapons.length) return false
  // Evaluate base damage against the selected form, so a generic +1 weapon does not
  // match slashing damage when the requested form is a rapier or a net.
  if (filters.damage && !tag.bonusDamageTypes?.includes(filters.damage) &&
    (tag.replacesDamage || !weapons.some(w => w.damage === filters.damage))) return false
  return true
}

/** Saved physical form and editable rules take precedence over the catalogue. */
export function matchesEquipmentItem(item:EquipmentItem,filters:ItemSearchFilters) {
  if(filters.category&&equipmentCategory(item)!==filters.category)return false
  if(filters.tag&&!equipmentTags(item).includes(filters.tag))return false
  if(filters.rarity&&item.rarity!==filters.rarity)return false
  if(filters.attunement&&!!item.requiresAttunement!==(filters.attunement==='required'))return false
  if(filters.armour){
    const base=forms.armours.find(a=>a.index===item.index)
    const group=item.armor?.category??base?.group.toLowerCase()
    if(!item.armor||!(item.index===filters.armour||filters.armour.toLowerCase()===`group:${group}`))return false
  }
  if(filters.weapon){
    if(!item.weapon)return false
    const group=item.weapon.category??forms.weapons.find(w=>w.index===item.index)?.group
    if(filters.weapon!==item.index&&filters.weapon.toLowerCase()!==`group:${group?.toLowerCase()}`&&filters.weapon!==`range:${item.weapon.ranged?'Ranged':'Melee'}`)return false
  }
  if(filters.damage){
    const baseDamage=item.weapon?.damageType.toLowerCase()
    const extra=item.magicIndex?tags[item.magicIndex]?.bonusDamageTypes:undefined
    if(baseDamage!==filters.damage&&!extra?.includes(filters.damage))return false
  }
  return true
}
export { itemSearchText } from './item-search'

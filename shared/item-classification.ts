import type { EquipmentItem } from './character'
import { itemKind } from './item-rules'

export const itemFormTags = ['necklace','amulet','ring','cloak','boots','gloves','belt','bracers','headwear','eyewear','robe','bag','instrument','tattoo','figurine'] as const
export const itemRarities = ['common','uncommon','rare','very rare','legendary','artifact','varies'] as const
export const armourCategories = ['light','medium','heavy','shield'] as const
export const titleCase = (text:string) => text.replace(/\b\w/g,letter=>letter.toUpperCase())
export function inferItemTags(name:string):string[] {
  const words=name.toLowerCase().replace(/[^a-z]+/g,' ')
  const patterns:Record<string,RegExp>={necklace:/\bnecklace\b/,amulet:/\b(amulet|periapt|medallion)\b/,ring:/\bring\b/,cloak:/\b(cloak|cape|mantle)\b/,boots:/\b(boots|slippers|sandals)\b/,gloves:/\b(gloves|gauntlets)\b/,belt:/\bbelt\b/,bracers:/\bbracers\b/,headwear:/\b(helm|helmet|hat|headband|circlet|crown|cap)\b/,eyewear:/\b(eyes|goggles|spectacles)\b/,robe:/\brobe\b/,bag:/\b(bag|sack|haversack|pouch)\b/,instrument:/\b(instrument|horn|pipes|drums|lute|lyre|flute|harp)\b/,tattoo:/\btattoo\b/,figurine:/\bfigurine\b/}
  return itemFormTags.filter(tag=>patterns[tag]!.test(words))
}
/** An explicitly saved empty tag list also opts out of name-based suggestions. */
export const equipmentTags=(item:Pick<EquipmentItem,'name'|'tags'>)=>item.tags??inferItemTags(item.name)
export function equipmentCategory(item:EquipmentItem):string {
  const kind=itemKind(item),category=(item.category??'').toLowerCase().replace(/[^a-z]/g,'')
  if(kind==='weapon')return 'weapon'
  if(kind==='armour')return 'armor'
  const standard:Record<string,string>={ring:'ring',rings:'ring',rod:'rod',rods:'rod',staff:'staff',staves:'staff',wand:'wand',wands:'wand',potion:'potion',potions:'potion',scroll:'scroll',scrolls:'scroll',ammunition:'ammunition'}
  if(standard[category])return standard[category]!
  if(kind==='accessory')return 'wondrous-items'
  return kind
}
export function itemClassificationLabel(item:EquipmentItem):string {
  return [item.armor?.category?`${titleCase(item.armor.category)}${item.armor.category==='shield'?'':' armour'}`:undefined,...equipmentTags(item).map(titleCase),item.rarity?titleCase(item.rarity):undefined].filter(Boolean).join(' · ')
}

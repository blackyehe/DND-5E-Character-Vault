import type { EquipmentItem } from './character'
import { equipmentFrom, magicEquipmentFrom, type EquipmentDefinition, type MagicItemDefinition } from './equipment-definitions'
import { itemKind } from './item-rules'
import { itemRarities } from './item-classification'

const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
const text=(value:unknown):string=>Array.isArray(value)?value.map(text).filter(Boolean).join('\n\n'):typeof value==='string'?value:''
const bonus=(value:unknown)=>typeof value==='number'&&Number.isInteger(value)&&Math.abs(value)<=20?value:typeof value==='string'&&/^[+-]?\d+$/.test(value.trim())&&Math.abs(Number(value))<=20?Number(value):undefined

/** Convert a freshly authorized full definition, never a cached browsing row.
 * Conditional/formula effects stay in its description for the DM to review. */
export function importedEquipment(entry:Record<string,unknown>,kind:'equipment'|'magic-items'):EquipmentItem{
 const view=object(entry.itemView),source=entry.workshopItem??view.filterItem
 const magical=kind==='magic-items'
 let item:EquipmentItem
 if(source&&typeof source==='object')item=structuredClone(source as EquipmentItem)
 else if(magical)item=magicEquipmentFrom({index:String(entry.index),name:String(entry.name),equipment_category:object(entry.equipment_category).name?entry.equipment_category:{index:'wondrous-items',name:'Wondrous Items'},...entry,desc:Array.isArray(entry.desc)?entry.desc:[text(entry.description)]} as MagicItemDefinition)
 else item=equipmentFrom({equipment_category:{index:'adventuring-gear',name:'Adventuring Gear'},...entry} as unknown as EquipmentDefinition)
 const raw=object(object(object(entry.details)[':codex/item']).item)
 item={...item,name:String(entry.name),description:text(view.description)||item.description||text(entry.description??entry.desc),magical,kind:itemKind(item),qty:1,equipped:false,attuned:false,notes:item.notes??''}
 // Imported base indexes keep weapon training/base stats; the full source index
 // identifies the magical definition independently of a mundane SRD base.
 if(magical)item.magicIndex=String(entry.index)
 else item.index=String(entry.index)
 const rarity=item.rarity?.toLowerCase().replace(/-/g,' ')
 item.rarity=itemRarities.find(value=>value===rarity)
 item.magicBonus=bonus(raw.bonusWeapon)??(item.armor?bonus(raw.bonusAc):undefined)??item.magicBonus??0
 item.effects={ac:item.armor?item.effects?.ac??0:bonus(raw.bonusAc)??item.effects?.ac??0,saves:bonus(raw.bonusSavingThrow)??item.effects?.saves??0}
 delete item._id;delete item.grantId;delete item.templateId;delete item.templateRevision
 return item
}

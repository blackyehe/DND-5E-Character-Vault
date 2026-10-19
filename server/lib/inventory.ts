import { z } from 'zod'
import type { Character, EquipmentItem } from '../../shared/character'
import { attunementError, itemKind } from '../../shared/item-rules'
import { resolveEquipmentItem } from './equipment-references'
import { armourCategories, itemRarities } from '../../shared/item-classification'

const bonus=z.number().int().min(-20).max(20)
/** Mixed legacy/template documents may contain BSON nulls for absent optional
 * fields. Treat them as absent, while required fields still validate normally. */
function omitEmpty(value:unknown):unknown {
  if(Array.isArray(value))return value.map(omitEmpty)
  return value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([,v])=>v!==null&&v!==undefined).map(([k,v])=>[k,omitEmpty(v)])):value
}
export const itemSchema=z.preprocess(omitEmpty,z.object({
  name:z.string().trim().min(1).max(200),qty:z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),weight:z.number().finite().min(0).max(100000),
  equipped:z.boolean(),notes:z.string().max(20000).default(''),kind:z.enum(['weapon','armour','accessory','consumable','treasure','gear']),
  magical:z.boolean().default(false),requiresAttunement:z.boolean().default(false),attuned:z.boolean().default(false),
  effects:z.object({ac:bonus,saves:bonus}).optional(),magicBonus:bonus.optional(),
  tags:z.array(z.string().trim().min(1).max(40)).max(20).optional(),rarity:z.enum(itemRarities).optional(),
  value:z.object({amount:z.number().finite().min(0).max(1000000000),currency:z.enum(['cp','sp','ep','gp','pp'])}).optional(),
  attunementRequirement:z.string().max(500).optional(),
  index:z.string().max(200).optional(),magicIndex:z.string().max(200).optional(),templateId:z.string().regex(/^[a-f0-9]{24}$/).optional(),templateRevision:z.number().int().min(0).optional(),category:z.string().max(100).optional(),
  description:z.string().max(30000).default(''),referenceDescription:z.string().max(30000).optional(),
  armor:z.object({base:z.number().int().min(0).max(40),dex:z.boolean(),cap:z.number().int().min(0).max(20).optional(),shield:z.boolean(),category:z.enum(armourCategories).optional()}).optional(),
  weapon:z.object({dice:z.string().max(30).regex(/^\d{1,2}d\d{1,3}(?:\s*[+-]\s*\d{1,3})?$/i),damageType:z.string().min(1).max(60),range:z.string().max(100),finesse:z.boolean(),ranged:z.boolean(),category:z.string().max(40).optional(),noDamage:z.boolean().optional()}).optional(),
}).superRefine((item,ctx)=>{
  if(item.kind==='weapon'&&!item.weapon)ctx.addIssue({code:'custom',message:'A weapon needs damage dice and a damage type.'})
  if(item.kind==='armour'&&!item.armor)ctx.addIssue({code:'custom',message:'Armour needs its base AC or shield bonus.'})
  if(item.kind!=='treasure'&&item.qty>9999)ctx.addIssue({code:'custom',message:'Item quantity must be no greater than 9999.'})
}))
export const grantSchema=z.object({requestId:z.uuid(),item:itemSchema,remember:z.boolean().optional()}).strict()
export function prepareItem(input:EquipmentItem):EquipmentItem {
  const item=resolveEquipmentItem(input)
  item.kind=itemKind(item)
  item.attuned=!!item.requiresAttunement&&!!input.attuned
  if(item.kind==='treasure'){item.equipped=false;item.attuned=false}
  return item
}
export function inventoryAfterGrant(before:Character,item:EquipmentItem,requestId:string) {
  const previous=before.equipment.find(i=>i.grantId===requestId)
  if(previous)return {equipment:before.equipment,duplicate:true}
  if(before.equipment.length>=1000)throw new Error('This inventory already has 1000 entries.')
  const added={...prepareItem(item),grantId:requestId}
  const equipment=[...before.equipment.map(i=>added.equipped&&added.armor&&i.armor&&i.armor.shield===added.armor.shield?{...i,equipped:false}:i),added]
  if(added.attuned){const error=attunementError(equipment);if(error)throw new Error(error)}
  return {equipment,duplicate:false}
}
export function applyItemTemplate(items:EquipmentItem[],template:EquipmentItem,id:string,revision:number):EquipmentItem[] {
  const definition=prepareItem(template)
  return items.map(copy=>copy.templateId===id&&(copy.templateRevision??-1)<revision?{
    ...definition,_id:copy._id,templateId:id,templateRevision:revision,grantId:copy.grantId,
    qty:copy.qty,equipped:copy.equipped,attuned:!!definition.requiresAttunement&&!!copy.attuned,notes:copy.notes||definition.notes,
  }:copy)
}
